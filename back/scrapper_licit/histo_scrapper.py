# -*- coding: utf-8 -*-
"""
Created on Fri Oct 30 18:42:46 2026

@author: benja
"""
import json
from pathlib import Path
import requests
import time

from back.scrapper_licit.licitor_scrapper import (build_soup_session, 
                             extract_announcement_urls, 
                             parse_announcement,
                             build_warnings,
                             save_output)

def run_scrapper(
         session,
         request_delay,
         base_url, search_url, 
         output_path, debug_path,
         max_pages = None, max_announces = None, 
         max_pub_dt = None, max_vis_dt = None
         ):

    print("Recherche des annonces...")
    print(search_url)


    urls = extract_announcement_urls(
        session,
        request_delay,
        base_url, search_url,
        max_pages=max_pages,
        max_announces=max_announces,
        max_pub_dt = max_pub_dt,
        max_vis_dt = max_vis_dt
    )
    
    print(
        f"\n{len(urls)} annonces trouvées au total."
    )

    # Échantillon uniquement.
    urls = urls[:max_announces]

    print(
        f"Test sur {len(urls)} annonces."
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
                
                

    """
    ###########
    #ENRICHISSEMENT DONNEES AVEC INFOS GEO
    ###########
    
    clean_results = enrich_handler(results)
    new_els = len(clean_results)
    print(new_els, " nouveaux biens identifiés.")
    
    ###########
    #ADD OLD VISITS DATA BUT AUCTIONS NOT BE PASSED
    ###########
    
    clean_results = merge_output(clean_results, past_dict)
    final_els = len(clean_results)
    past_els = (final_els - new_els)
    print(past_els, "biens conservés pour ventes à venir.")
    
    ###########
    #WARNINGS
    ###########
    
    warnings = build_warnings(clean_results)
    
    ###########
    #SAUVEGARDE
    ###########

    save_output(clean_results, output_path, "auctions.json")
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
        f"Annonces récupérées : {new_els}"
    )
    
    print(
        f"Erreurs : {len(errors)}"
    )
    
    print(
        f"Annonces avec warnings : {len(warnings)}"
    )
    
    print("=" * 50)
    """
    
    return results


def scrapper_handler(max_pages, max_announces,
                     max_pub_dt,
                     max_visit_dt = None,
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
    
    URLS = ["/".join([STRUCT_URL, el, "historique-des-adjudications.html"]) for el in GEO_ZONES]

    SEARCH_URL = URLS[0]
    
    try:
        BASE_DIR = Path(__file__).resolve().parents[2]
    except NameError:
        BASE_DIR = Path.cwd() / "Documents" / "licitor_app"
    
    OUTPUT_PATH = BASE_DIR / "front" / "data"
    DEBUG_PATH = BASE_DIR / "tests" / "scrapper_debug"
    
    #NEW DATA
    
    session = build_soup_session()
    
    scrapper_out = run_scrapper(
         session,
         request_delay,
         BASE_URL, SEARCH_URL, 
         OUTPUT_PATH, DEBUG_PATH, 
         max_pages, max_announces,
         max_pub_dt, max_visit_dt)
    
    return scrapper_out