# -*- coding: utf-8 -*-
"""
Created on Wed Nov 18 09:51:52 2026

@author: benja
"""

from pathlib import Path
from back.scrapper_licit.utils import build_urls
from back.scrapper_licit.running_scrapper import run_scrapper
from historical_database.manage_bdd import get_max_dt


def manage_scrap_urls():
    
    BASE_URL = "https://www.licitor.com"
    
    STRUCT_URL = "https://www.licitor.com/ventes-aux-encheres-immobilieres"
    
    GEO_ZONES = ["paris-et-ile-de-france",
                 "regions-du-nord-est",
                 "bretagne-grand-ouest",
                 "centre-loire-limousin",
                 "sud-ouest-pyrenees",
                 "sud-est-mediterrannee"
                 ]
    
    BIENS_CATEGS = ['appartement', 'studio-chambre', 'maison-pavillon-propriete', 'immeuble-residentiel']
    
    VISITES_SEARCH_URLS = build_urls("VISITE", STRUCT_URL, GEO_ZONES, BIENS_CATEGS)
    VENTES_SEARCH_URLS = build_urls("VENTE", STRUCT_URL, GEO_ZONES, BIENS_CATEGS)
    
    #OUTPUT
    
    visites = {"BASE_URL": BASE_URL,
               "SEARCH_URLS": VISITES_SEARCH_URLS}
    
    ventes = {"BASE_URL": BASE_URL,
               "SEARCH_URLS": VENTES_SEARCH_URLS}
    
    urls = {"VISITE": visites,
            "VENTE": ventes}
    
    return urls

def manage_params():
    
    urls_dict = manage_scrap_urls()
    
    BASE_DIR = Path(r"C:/Users/benja/Documents/licitor_app")
    
    visites = {"MAX_PAGES": None,
               "MAX_ANNOUNCES": None,
               "MAX_DT": None,
               "OUTPUT_FOLDER_PATH": BASE_DIR / "front" / "data",
               "OUTPUT_FILE_NAME": "auctions.json",
               "DEBUG_PATH": BASE_DIR / "tests" / "scrapper_debug" / "visits",
               "BASE_URL": urls_dict["VISITE"]["BASE_URL"],
               "SEARCH_URLS": urls_dict["VISITE"]["SEARCH_URLS"]
               }
    
    ventes = {"MAX_PAGES": None,
               "MAX_ANNOUNCES": None,
               "MAX_DT": get_max_dt(),
               "OUTPUT_FOLDER_PATH": BASE_DIR / "historical_database" / "data",
               "OUTPUT_FILE_NAME": "sales.json",
               "DEBUG_PATH": BASE_DIR / "tests" / "scrapper_debug" / "histo",
               "BASE_URL": urls_dict["VENTE"]["BASE_URL"],
               "SEARCH_URLS": urls_dict["VENTE"]["SEARCH_URLS"]
               }
    
    params = {"VISITE": visites,
              "VENTE": ventes}
    
    return params


def scrapper_handler(method):
    
    params = manage_params()[method]
    
    output = run_scrapper(method, params)
    
    return output