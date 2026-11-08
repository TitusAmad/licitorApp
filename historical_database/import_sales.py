
import os
import json
import math
import argparse

from pathlib import Path
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone

import psycopg
from psycopg.types.json import Jsonb
from dotenv import load_dotenv


# =====================================================
# CONFIGURATION
# =====================================================

try:
    BASE_DIR = Path(__file__).resolve().parents[2]
except NameError:
    BASE_DIR = Path.cwd()
    
ENV_FILE = BASE_DIR / "licitor_app" / "historical_database" / ".env.txt"

load_dotenv(dotenv_path=ENV_FILE, override=True)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
}

SOURCE_NAME = "licitor"

DEFAULT_JSON_FILE = Path("data/sales.json")

# Vérification de la configuration
if not all(DB_CONFIG.values()):
    raise ValueError(
        "Configuration Supabase incomplète dans .env.txt"
    )

# =====================================================
# CHARGEMENT ET VALIDATION DU JSON
# =====================================================

def load_json(file_path):

    if not file_path.exists():
        raise FileNotFoundError(
            f"Fichier introuvable : {file_path}"
        )

    with file_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError(
            "Le JSON doit être un dictionnaire."
        )

    if not data:
        raise ValueError(
            "Le fichier JSON est vide. Import annulé."
        )

    for source_id, sale in data.items():

        if not isinstance(sale, dict):
            raise ValueError(
                f"Format invalide pour la vente {source_id}"
            )

        if str(sale.get("id")) != str(source_id):
            raise ValueError(
                f"Incohérence d'identifiant : {source_id}"
            )

        coords = sale.get("coords") or {}

        lat = coords.get("latitude")
        lng = coords.get("longitude")

        if lat is not None:
            if not math.isfinite(float(lat)):
                raise ValueError(
                    f"Latitude non valide : {source_id}"
                )

            if not -90 <= float(lat) <= 90:
                raise ValueError(
                    f"Latitude hors limites : {source_id}"
                )

        if lng is not None:
            if not math.isfinite(float(lng)):
                raise ValueError(
                    f"Longitude non valide : {source_id}"
                )

            if not -180 <= float(lng) <= 180:
                raise ValueError(
                    f"Longitude hors limites : {source_id}"
                )

    return data


# =====================================================
# NORMALISATION DES DONNEES
# =====================================================

def normalize_sale(source_id, sale):

    coords = sale.get("coords") or {}

    latitude = coords.get("latitude")
    longitude = coords.get("longitude")

    code_postal = sale.get("code_postal")

    code_region = sale.get("code_region")

    return {

        "id": str(source_id),

        "titre": sale.get("titre"),
        "url": sale.get("url"),

        "date_publication": sale.get("date_publication"),
        "dt_vente": sale.get("dt_vente"),
        "dt_vente_limit": sale.get("dt_vente_limit"),

        "tribunal": sale.get("tribunal"),
        "type_vente": sale.get("type_vente"),
        "sell_state": sale.get("sell_state"),

        "mise_a_prix": sale.get("mise_a_prix"),
        "est_price": sale.get("est_price"),
        "fac_baisse": sale.get("fac_baisse"),
        "prix_final": sale.get("prix_final"),

        "trib_anom": sale.get("trib_anom"),

        "ville": sale.get("ville"),
        "adresse": sale.get("adresse"),

        "code_postal": (
            str(code_postal)
            if code_postal is not None else None
        ),

        "code_insee": sale.get("code_insee"),
        "code_departement": sale.get("code_departement"),

        "code_region": (
            str(int(code_region))
            if code_region is not None else None
        ),

        "nom_departement": sale.get("nom_departement"),
        "nom_region": sale.get("nom_region"),

        "latitude": latitude,
        "longitude": longitude,

        "type": sale.get("type"),
        "description": sale.get("description"),
        "occupation": sale.get("occupation"),
        "surface_m2": sale.get("surface_m2"),

        "stats_bien": sale.get("stats_bien"),
        "est_price_m2": sale.get("est_price_m2"),

        "visite": sale.get("visite"),
        "visite_dt": sale.get("visite_dt"),
        "visite_state": sale.get("visite_state"),

        "avocats": sale.get("avocats"),
        "telephones": sale.get("telephones"),
        "documents": sale.get("documents"),

        "raw_data": sale
    }


# =====================================================
# CONVERSION DES VALEURS JSONB
# =====================================================

JSON_COLUMNS = {
    "type",
    "description",
    "stats_bien",
    "avocats",
    "telephones",
    "documents",
    "raw_data"
}


def prepare_value(column, value):

    if column in JSON_COLUMNS:

        if value is None:
            return None

        return Jsonb(value)

    return value


# =====================================================
# INSERTION D'UNE NOUVELLE VENTE
# =====================================================

INSERT_COLUMNS = [
    "id",
    "titre",
    "url",
    "date_publication",
    "dt_vente",
    "dt_vente_limit",
    "tribunal",
    "type_vente",
    "sell_state",
    "mise_a_prix",
    "est_price",
    "fac_baisse",
    "prix_final",
    "trib_anom",
    "ville",
    "adresse",
    "code_postal",
    "code_insee",
    "code_departement",
    "code_region",
    "nom_departement",
    "nom_region",
    "latitude",
    "longitude",
    "location",
    "type",
    "description",
    "occupation",
    "surface_m2",
    "stats_bien",
    "est_price_m2",
    "visite",
    "visite_dt",
    "visite_state",
    "avocats",
    "telephones",
    "documents",
    "raw_data",
    "import_id"
]


def insert_sale(cur, sale, import_id):

    columns = ", ".join(
        f'"{column}"' for column in INSERT_COLUMNS
    )

    placeholders = []

    for column in INSERT_COLUMNS:

        if column == "location":

            placeholders.append("""
                CASE
                    WHEN %s IS NULL OR %s IS NULL
                    THEN NULL
                    ELSE ST_SetSRID(
                        ST_MakePoint(%s, %s),
                        4326
                    )::extensions.geography
                END
            """)

        else:
            placeholders.append("%s")

    values = []

    for column in INSERT_COLUMNS:

        if column == "location":

            lat = sale["latitude"]
            lng = sale["longitude"]

            values.extend([lat, lng, lng, lat])

        elif column == "import_id":

            values.append(import_id)

        else:

            values.append(
                prepare_value(
                    column,
                    sale.get(column)
                )
            )

    query = f"""
        INSERT INTO public.sales ({columns})
        VALUES ({", ".join(placeholders)})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
    """

    cur.execute(query, values)

    return cur.fetchone()


# =====================================================
# TRAITEMENT DES VENTES
# =====================================================

def process_sale(cur, source_id, raw_sale, import_id):

    sale = normalize_sale(source_id, raw_sale)

    # Tentative d'insertion.
    # Si la vente existe déjà, aucune colonne n'est modifiée.

    inserted = insert_sale(cur, sale, import_id)

    if inserted is not None:
        return "inserted"

    # La vente existe déjà.
    # On verrouille sa ligne pour éviter les modifications
    # concurrentes pendant la comparaison.

    cur.execute("""
        SELECT prix_final
        FROM public.sales
        WHERE id = %s
        FOR UPDATE
    """, (sale["id"],))

    result = cur.fetchone()

    if result is None:
        raise RuntimeError(
            f"Impossible de retrouver la vente {source_id}"
        )

    old_price = result[0]
    new_price = sale["prix_final"]

    # Un prix NULL dans le nouveau JSON ne modifie rien.
    if new_price is None:
        return "unchanged"

    new_price = Decimal(str(new_price))

    # Aucun changement de prix.
    if old_price is not None:

        old_price = Decimal(str(old_price))

        if old_price == new_price:
            return "unchanged"

    # Historisation uniquement si un ancien prix existe.
    if old_price is not None:

        cur.execute("""
            INSERT INTO public.sale_price_history (
                sale_id,
                old_price,
                new_price,
                import_id
            )
            VALUES (%s, %s, %s, %s)
        """, (
            sale["id"],
            old_price,
            new_price,
            import_id
        ))

    # Mise à jour du seul prix final.
    cur.execute("""
        UPDATE public.sales
        SET
            prix_final = %s,
            updated_at = NOW()
        WHERE id = %s
    """, (
        new_price,
        sale["id"]
    ))

    return "updated"


# =====================================================
# IMPORT PRINCIPAL
# =====================================================

def import_sales(file_path):


    print("\nChargement du fichier JSON...")

    data = load_json(file_path)

    total = len(data)

    print(f"{total} ventes détectées.")

    inserted = 0
    updated = 0
    unchanged = 0

    # Création de l'entrée d'import.
    # On la valide séparément afin de conserver une trace
    # même si le traitement des ventes échoue.

    with psycopg.connect(**DB_CONFIG) as conn:

        with conn.cursor() as cur:

            cur.execute("""
                INSERT INTO public.import_history (
                    source,
                    filename,
                    status,
                    total_records
                )
                VALUES (%s, %s, 'running', %s)
                RETURNING id
            """, (
                SOURCE_NAME,
                file_path.name,
                total
            ))

            import_id = cur.fetchone()[0]

    print(f"\nImport n°{import_id} démarré.")

    try:

        # Transaction contenant toutes les ventes.
        with psycopg.connect(**DB_CONFIG) as conn:

            with conn.cursor() as cur:

                for index, (source_id, raw_sale) in enumerate(
                    data.items(),
                    start=1
                ):

                    result = process_sale(
                        cur,
                        source_id,
                        raw_sale,
                        import_id
                    )

                    if result == "inserted":
                        inserted += 1

                    elif result == "updated":
                        updated += 1

                    else:
                        unchanged += 1

                    if index % 100 == 0:
                        print(
                            f"Traitement : {index}/{total}"
                        )

                # Mise à jour du bilan de l'import.
                cur.execute("""
                    UPDATE public.import_history
                    SET
                        status = 'success',
                        completed_at = NOW(),
                        inserted_records = %s,
                        updated_records = %s,
                        skipped_records = %s
                    WHERE id = %s
                """, (
                    inserted,
                    updated,
                    unchanged,
                    import_id
                ))

        # La transaction est validée à la sortie du bloc.

    except Exception as error:

        # La transaction des ventes a été annulée.
        # On conserve néanmoins le statut d'échec de l'import.

        with psycopg.connect(**DB_CONFIG) as conn:

            with conn.cursor() as cur:

                cur.execute("""
                    UPDATE public.import_history
                    SET
                        status = 'failed',
                        completed_at = NOW(),
                        error_message = %s
                    WHERE id = %s
                """, (
                    str(error)[:2000],
                    import_id
                ))

        raise

    # =================================================
    # RAPPORT FINAL
    # =================================================

    print("\n" + "=" * 45)
    print("IMPORT TERMINÉ AVEC SUCCÈS")
    print("=" * 45)

    print(f"Fichier              : {file_path}")
    print(f"Total des ventes     : {total}")
    print(f"Nouvelles ventes     : {inserted}")
    print(f"Prix modifiés        : {updated}")
    print(f"Ventes inchangées    : {unchanged}")

    print("=" * 45)


# =====================================================
# POINT D'ENTRÉE
# =====================================================

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="Import des ventes immobilières"
    )

    parser.add_argument(
        "--file",
        type=Path,
        default=DEFAULT_JSON_FILE,
        help="Chemin du fichier JSON à importer"
    )

    args = parser.parse_args()

    import_sales(args.file)
