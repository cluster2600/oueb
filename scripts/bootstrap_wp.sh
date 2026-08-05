#!/bin/bash
# Bootstrap WordPress MultiSite (résout le poulet-œuf des constantes MULTISITE).
# À lancer UNE fois après `docker compose up -d`. Utilise wp-cli dans le conteneur.
set -euo pipefail

: "${MAIN_DOMAIN:?export MAIN_DOMAIN=oueb.example}"
WP_ADMIN_USER="${WP_ADMIN_USER:-admin}"
WP_ADMIN_PASSWORD="${WP_ADMIN_PASSWORD:?export WP_ADMIN_PASSWORD=...}"
WP_ADMIN_EMAIL="${WP_ADMIN_EMAIL:-admin@$MAIN_DOMAIN}"

wp() { docker compose exec -T -u www-data wordpress wp --path=/var/www/html "$@"; }

# wp-cli n'est pas dans l'image officielle par défaut : on l'installe à la volée.
docker compose exec -T -u root wordpress bash -c '
  command -v wp >/dev/null 2>&1 || {
    curl -sSLo /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
    chmod +x /usr/local/bin/wp; }'

echo "==> 1/3 Installation WordPress (single site)"
wp core install \
  --url="https://$MAIN_DOMAIN" \
  --title="OUEB Network" \
  --admin_user="$WP_ADMIN_USER" \
  --admin_password="$WP_ADMIN_PASSWORD" \
  --admin_email="$WP_ADMIN_EMAIL" \
  --skip-email

echo "==> 2/3 Conversion en réseau MultiSite (sous-domaines)"
wp core multisite-convert --subdomains --title="OUEB Network"

echo "==> 3/3 Activez maintenant OUEB_MULTISITE_READY=1 puis redémarrez WordPress :"
echo "    sed -i 's/^OUEB_MULTISITE_READY=.*/OUEB_MULTISITE_READY=1/' .env"
echo "    docker compose up -d wordpress"
echo
echo "Puis créez le mot de passe d'application du Super Admin :"
echo "    docker compose exec -T -u www-data wordpress wp user application-password create \\"
echo "        $WP_ADMIN_USER oueb --porcelain"
echo "(reportez-le dans WP_APP_PASSWORD du .env, et créez un site template = template_id)"
