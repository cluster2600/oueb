<?php
/**
 * sunrise.php — résolution des domaines clients mappés vers le bon subsite.
 *
 * Chargé très tôt (avant ms-settings) quand SUNRISE='on'. Pour un domaine client
 * arbitraire (ex: cabinet-durand.ch) pointant vers l'IP du VPS, on cherche une
 * entrée exacte dans wp_blogs.domain et on force le bon blog. Le script
 * d'injection (oueb-provisioner) écrit wp_blogs.domain = le domaine client.
 *
 * @package oueb
 */
if ( ! defined( 'ABSPATH' ) && ! defined( 'MULTISITE' ) ) {
	return;
}

global $wpdb, $current_blog, $current_site;

$host = isset( $_SERVER['HTTP_HOST'] ) ? strtolower( preg_replace( '/:\d+$/', '', $_SERVER['HTTP_HOST'] ) ) : '';
if ( '' === $host ) {
	return;
}

// Domaine principal / sous-domaines : laisser le cœur de WP gérer.
$main = getenv( 'MAIN_DOMAIN' );
if ( $main && ( $host === $main || substr( $host, -strlen( $main ) - 1 ) === '.' . $main ) ) {
	return;
}

$blog = $wpdb->get_row(
	$wpdb->prepare( "SELECT * FROM {$wpdb->blogs} WHERE domain = %s AND path = '/' LIMIT 1", $host )
);
if ( ! $blog ) {
	return; // domaine inconnu -> WP renverra 404, Caddy n'aurait pas dû signer.
}

$current_blog                = $blog;
$current_blog->domain        = $host;
$current_site                = $wpdb->get_row(
	$wpdb->prepare( "SELECT * FROM {$wpdb->site} WHERE id = %d LIMIT 1", $blog->site_id )
);
$current_site->cookie_domain = $host;

define( 'COOKIE_DOMAIN', $host );
define( 'DOMAIN_CURRENT_SITE', $host );
