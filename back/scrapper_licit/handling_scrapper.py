# -*- coding: utf-8 -*-
"""
Created on Wed Nov 18 09:51:52 2026

@author: benja
"""

from pathlib import Path
from back.scrapper_licit.utils import build_urls
from back.scrapper_licit.running_scrapper import run_scrapper
from historical_database.manage_bdd import get_max_dt
from config import BASE_DIR


def manage_scrap_urls(method):
    
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
        
    URLS = build_urls(method, STRUCT_URL, GEO_ZONES, BIENS_CATEGS)
    
    #OUTPUT
    
    out = {"BASE_URL": BASE_URL,
               "SEARCH_URLS": URLS}
    
    return out

def manage_params(method):
    
    urls_dict = manage_scrap_urls(method)
    
    if method == "VISITE":
        max_dt = None
        out_folder_path = BASE_DIR / "front" / "data"
        out_name = "auctions.json"
        debug_folder = "visits"
    else:
        max_dt = get_max_dt()
        out_folder_path = BASE_DIR / "historical_database" / "data"
        out_name = "sales.json"
        debug_folder = "histo"
        
    out = {"MAX_PAGES": None,
               "MAX_ANNOUNCES": None,
               "MAX_DT": max_dt,
               "OUTPUT_FOLDER_PATH": out_folder_path,
               "OUTPUT_FILE_NAME": out_name,
               "DEBUG_PATH": BASE_DIR / "tests" / "scrapper_debug" / debug_folder,
               "BASE_URL": urls_dict["BASE_URL"],
               "SEARCH_URLS": urls_dict["SEARCH_URLS"]
               }
    
    return out


def scrapper_handler(method):
    
    params = manage_params(method)
    
    output = run_scrapper(method, params)
    
    return output