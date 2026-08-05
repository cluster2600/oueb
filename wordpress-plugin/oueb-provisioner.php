<?php
/**
 * Plugin Name: OUEB Provisioner
 * Description: Endpoint REST pour cloner un site template du réseau MultiSite et y
 *              injecter le contenu + SEO générés par l'IA. MU-plugin (toujours actif).
 * Version: 1.0.0
 *
 * Route : POST /wp-json/oueb/v1/sites
 * Auth  : Application Password d'un Super Admin (Basic Auth), capability manage_network.
 *
 * @package oueb
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'rest_api_init', function () {
	register_rest_route( 'oueb/v1', '/sites', array(
		'methods'             => 'POST',
		'permission_callback' => function () {
			return current_user_can( 'manage_network' );
		},
		'args'                => array(
			'template_id' => array( 'required' => true, 'type' => 'integer' ),
			'slug'        => array( 'required' => true, 'type' => 'string' ),
			'title'       => array( 'required' => true, 'type' => 'string' ),
			'lang'        => array( 'required' => false, 'type' => 'string' ),
			'domain'      => array( 'required' => false, 'type' => 'string' ),
			'seo'         => array( 'required' => true, 'type' => 'object' ),
		),
		'callback'            => 'oueb_create_site',
	) );
} );

/**
 * Crée un sous-site (sous-domaine du réseau), clone le thème + les options clés du
 * template, écrit la page d'accueil avec le contenu IA, puis mappe le domaine
 * client si fourni.
 *
 * @param WP_REST_Request $req
 * @return WP_REST_Response|WP_Error
 */
function oueb_create_site( WP_REST_Request $req ) {
	$template_id = (int) $req['template_id'];
	$slug        = sanitize_key( $req['slug'] );
	$title       = sanitize_text_field( $req['title'] );
	$lang        = sanitize_text_field( $req['lang'] ?? 'en_US' );
	$domain_map  = $req['domain'] ? strtolower( sanitize_text_field( $req['domain'] ) ) : '';
	$seo         = (array) $req['seo'];

	if ( ! get_blog_details( $template_id ) ) {
		return new WP_Error( 'oueb_no_template', 'Template introuvable', array( 'status' => 400 ) );
	}

	$network      = get_network();
	$new_domain   = SUBDOMAIN_INSTALL ? $slug . '.' . $network->domain : $network->domain;
	$new_path     = SUBDOMAIN_INSTALL ? '/' : '/' . $slug . '/';
	$super_admins = get_super_admins();
	$admin_user   = get_user_by( 'login', $super_admins[0] );

	// 1) Création du blog dans le réseau.
	$blog_id = wpmu_create_blog( $new_domain, $new_path, $title, $admin_user->ID, array( 'public' => 1 ), $network->id );
	if ( is_wp_error( $blog_id ) ) {
		return $blog_id;
	}

	// 2) Clonage du template (thème + options ciblées) puis injection contenu/SEO.
	$theme = oueb_read_template_theme( $template_id );
	switch_to_blog( $blog_id );

	if ( $theme['stylesheet'] ) {
		switch_theme( $theme['stylesheet'] );
	}
	update_option( 'blogname', $seo['title'] ?? $title );
	update_option( 'blogdescription', $seo['meta_description'] ?? '' );
	update_option( 'WPLANG', $lang );

	$page_id = oueb_upsert_front_page( $title, $seo );

	// SEO : Yoast si présent, sinon meta post génériques réutilisables par le thème.
	if ( ! empty( $seo['title'] ) ) {
		update_post_meta( $page_id, '_yoast_wpseo_title', $seo['title'] );
	}
	if ( ! empty( $seo['meta_description'] ) ) {
		update_post_meta( $page_id, '_yoast_wpseo_metadesc', $seo['meta_description'] );
	}

	$site_url = home_url( '/' );
	restore_current_blog();

	// 3) Mapping domaine client (Caddy signera à la volée quand il pointera vers le VPS).
	if ( $domain_map ) {
		oueb_map_domain( $blog_id, $domain_map );
		$site_url = 'https://' . $domain_map . '/';
	}

	return new WP_REST_Response( array(
		'blog_id'  => $blog_id,
		'url'      => $site_url,
		'domain'   => $domain_map ?: $new_domain,
		'page_id'  => $page_id,
	), 201 );
}

/** Lit le thème actif du template. */
function oueb_read_template_theme( int $template_id ): array {
	switch_to_blog( $template_id );
	$data = array(
		'stylesheet' => get_option( 'stylesheet' ),
		'template'   => get_option( 'template' ),
	);
	restore_current_blog();
	return $data;
}

/** Crée (ou remplace) la page d'accueil à partir du JSON SEO/contenu de l'IA. */
function oueb_upsert_front_page( string $title, array $seo ): int {
	$blocks  = '<!-- wp:heading {"level":1} --><h1>' . esc_html( $seo['h1'] ?? $title ) . '</h1><!-- /wp:heading -->';
	if ( ! empty( $seo['hero_subtitle'] ) ) {
		$blocks .= '<!-- wp:paragraph --><p>' . esc_html( $seo['hero_subtitle'] ) . '</p><!-- /wp:paragraph -->';
	}
	foreach ( (array) ( $seo['h2'] ?? array() ) as $h2 ) {
		$blocks .= '<!-- wp:heading {"level":2} --><h2>' . esc_html( $h2 ) . '</h2><!-- /wp:heading -->';
	}
	foreach ( (array) ( $seo['sections'] ?? array() ) as $sec ) {
		if ( ! empty( $sec['heading'] ) ) {
			$blocks .= '<!-- wp:heading {"level":2} --><h2>' . esc_html( $sec['heading'] ) . '</h2><!-- /wp:heading -->';
		}
		if ( ! empty( $sec['body'] ) ) {
			$blocks .= '<!-- wp:paragraph --><p>' . esc_html( $sec['body'] ) . '</p><!-- /wp:paragraph -->';
		}
	}

	$page_id = wp_insert_post( array(
		'post_title'   => $seo['h1'] ?? $title,
		'post_content' => $blocks,
		'post_status'  => 'publish',
		'post_type'    => 'page',
	) );

	update_option( 'show_on_front', 'page' );
	update_option( 'page_on_front', $page_id );
	return (int) $page_id;
}

/** Mappe un domaine client sur le blog (wp_blogs.domain) — résolu par sunrise.php. */
function oueb_map_domain( int $blog_id, string $domain ): void {
	global $wpdb;
	$wpdb->update( $wpdb->blogs, array( 'domain' => $domain, 'path' => '/' ), array( 'blog_id' => $blog_id ) );
	update_blog_option( $blog_id, 'siteurl', 'https://' . $domain );
	update_blog_option( $blog_id, 'home', 'https://' . $domain );
	clean_blog_cache( get_blog_details( $blog_id ) );
}
