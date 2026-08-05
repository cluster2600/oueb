-- Crée les deux bases applicatives dans l'unique instance PostgreSQL.
-- L'utilisateur POSTGRES_USER (propriétaire) existe déjà à ce stade.
CREATE DATABASE n8n      OWNER CURRENT_USER;
CREATE DATABASE listmonk OWNER CURRENT_USER;
