#!/bin/bash
# Injecte NVIDIA_API_KEY dans .env depuis OCI Vault, via INSTANCE PRINCIPAL
# (aucune clé/credential sur la box). À lancer au boot de la VM oueb, AVANT
# `docker compose up`. Prérequis :
#   - la VM est membre du dynamic group `oueb-vault-readers`
#     (policy `Allow dynamic-group oueb-vault-readers to read secret-bundles in tenancy`)
#   - l'outil `oci` est installé sur la VM
#   - export NVIDIA_SECRET_OCID (défaut ci-dessous = secret "nvidia" du tenancy)
set -euo pipefail

SECRET_ID="${NVIDIA_SECRET_OCID:-ocid1.vaultsecret.oc1.eu-zurich-1.amaaaaaaugj3bkqa3vmddyr5nyavhemvlleuuxmlajayegorpysnplcy6sha}"
ENV_FILE="${ENV_FILE:-.env}"

KEY=$(oci secrets secret-bundle get --auth instance_principal \
      --secret-id "$SECRET_ID" \
      --query 'data."secret-bundle-content".content' --raw-output | base64 -d)

[ -n "$KEY" ] || { echo "secret vide"; exit 1; }

touch "$ENV_FILE"
if grep -q '^NVIDIA_API_KEY=' "$ENV_FILE"; then
  sed -i "s|^NVIDIA_API_KEY=.*|NVIDIA_API_KEY=$KEY|" "$ENV_FILE"
else
  echo "NVIDIA_API_KEY=$KEY" >> "$ENV_FILE"
fi
echo "NVIDIA_API_KEY injectée depuis OCI Vault (instance principal)."
