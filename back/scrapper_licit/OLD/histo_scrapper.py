# -*- coding: utf-8 -*-
"""
Created on Fri Oct 30 18:42:46 2026

@author: benja
"""

"""
#TEST
import os
path = "C:/Users/benja/Documents/licitor_app/"
os.chdir(path)
"""

import json
from pathlib import Path
import requests
import time
from datetime import datetime
from datetime import timedelta

from back.scrapper_licit.licitor_scrapper import (build_soup_session, 
                             extract_announcement_urls, 
                             parse_announcement,
                             build_warnings,
                             save_output)

from back.geo_infos.geo_data import enrich_handler

#VARIABLES GLOBALES

MODE = "histo"

def run_scrapper(
         session,
         request_delay,
         base_url, search_urls, 
         output_path, debug_path,
         max_pages = None, max_announces = None, 
         max_dt = None
         ):
    
    """
    base_url = BASE_URL
    search_urls = SEARCH_URLS
    output_path = ""
    debug_path = ""
    max_pages = None
    max_announces = None
    max_dt = None
    scrap_mode = "vente"
    """

    print("Recherche des annonces...")
    print(len(search_urls), " liens à scrapper")
    
    urls = []
    
    for search_url in search_urls:
    
        occ_urls = extract_announcement_urls(
            session,
            request_delay,
            base_url, search_url,
            max_pages=max_pages,
            max_announces=max_announces,
            max_dt=max_dt,
            scrap_mode = "vente"
        )
        
        print(
            f"\n{len(occ_urls)} annonces trouvées pour le lien suivant\n"
        )
        print(search_url)
        
        urls.extend(occ_urls)
    
    print(
        f"\n{len(urls)} annonces trouvées au total."
    )

    if not max_announces is None:
        
        # Échantillon uniquement.
        urls = urls[:max_announces]
    
        print(
            f"\nEchantillon sur {len(urls)} annonces."
            )

    results = {}
    errors = []
    warnings = []
    dbls = []

    for index, url in enumerate(
        urls,
        start=1,
    ):

        print(
            f"\n[{index}/{len(urls)}]"
        )

        try:
        
            annonce = parse_announcement(session, url, debug_path)
        
            if annonce:
        
                for bien in annonce:
                    id_bien = bien["id"]
                    if ((id_bien not in results) and (not id_bien is None)):
                        results[id_bien] = bien
                    else:
                        if (not id_bien is None):
                            dbls.append({
                                "url": url,
                                "id": id_bien
                                })
                            print(f"Bien déja ajouté aux résultats: {id_bien}")
                
        except requests.RequestException as error:
        
            print(
                f"Erreur HTTP : {error}"
            )
        
            errors.append({
                "url": url,
                "type": "http",
                "error": str(error),
            })
        
        except Exception as error:
        
            print(
                f"Erreur parsing : {error}"
            )
        
            errors.append({
                "url": url,
                "type": "parsing",
                "error": str(error),
            })
    
    
    
            # Respect du serveur.
            if index < len(urls):
                time.sleep(request_delay)
                
                
    print("\n*************************\n", 
          "Enrichissement Géographique...", 
          "\n**************************")

    ###########
    #ENRICHISSEMENT DONNEES AVEC INFOS GEO
    ###########
    
    clean_results = enrich_handler(results)
    new_els = len(clean_results)
    
    ###########
    #WARNINGS
    ###########
    
    warnings = build_warnings(clean_results, MODE)
    
    ###########
    #SAUVEGARDE
    ###########

    save_output(clean_results, output_path, "sales.json")
    save_output(errors, debug_path, "errors.json")
    save_output(warnings, debug_path, "warnings.json")
    save_output(dbls, debug_path, "doublons.json")    

    print()
    print("=" * 50)
    print("RAPPORT DU SCRAPING")
    print("=" * 50)
    
    print(
        f"URLs demandées : {len(urls)}"
    )
    
    print(
        f"Ventes récupérées : {new_els}"
    )
    
    print(
        f"Erreurs : {len(errors)}"
    )
    
    print(
        f"Ventes avec warnings : {len(warnings)}"
    )
    
    print("=" * 50)
    
    return results


def scrapper_handler(max_pages, max_announces,
                     max_dt = None,
                     request_delay = 2.0):
    
    #POINT DENTREE SCRAPPING
    
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
    
    SEARCH_URLS = build_urls(STRUCT_URL, GEO_ZONES, BIENS_CATEGS)
    
    #GESTION SCRAP
    start = 12
    SEARCH_URLS = SEARCH_URLS[start:]
    
    try:
        BASE_DIR = Path(__file__).resolve().parents[2]
    except NameError:
        BASE_DIR = Path.cwd() / "Documents" / "licitor_app"
    
    OUTPUT_PATH = BASE_DIR / "historical_database" / "data"
    DEBUG_PATH = BASE_DIR / "tests" / "scrapper_debug" / "histo"
    
    #NEW DATA
    
    session = build_soup_session()
    
    scrapper_out = run_scrapper(
         session,
         request_delay,
         BASE_URL, SEARCH_URLS, 
         OUTPUT_PATH, DEBUG_PATH, 
         max_pages, max_announces,
         max_dt)
    
    return scrapper_out

#HELPERS

def build_urls(struct_url, geo_zones, biens_categs):
    
    urls = []
    
    for zone in geo_zones:
        
        for categ in biens_categs:
            
            url = "/".join([struct_url, zone, categ]) + ".html?type=H"
            
            #print(f"{url}\n")
            
            urls.append(url)
            
    return urls
        
        