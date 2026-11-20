# -*- coding: utf-8 -*-
"""
Created on Fri Nov 20 13:31:47 2026

@author: benja
"""

from pathlib import Path

# Racine du projet
try:
    BASE_DIR = Path(__file__).resolve().parent
except:
    BASE_DIR = Path(r"C:/Users/benja/Documents/licitor_app")

# Dossiers principaux
BACK_DIR = BASE_DIR / "back"
FRONT_DIR = BASE_DIR / "front"
HISTORICAL_DB_DIR = BASE_DIR / "historical_database"
SCRIPTS_DIR = BASE_DIR / "scripts"

# Fichiers de configuration
ENV_FILE = HISTORICAL_DB_DIR / ".env.txt"

# Données
DATA_DIR = HISTORICAL_DB_DIR / "data"
FRONT_DATA_DIR = FRONT_DIR / "data"

# Debug
DEBUG_DIR = BASE_DIR / "tests" / "scrapper_debug"