# -*- coding: utf-8 -*-
"""
Created on Wed Oct 28 19:41:24 2026

@author: benja
"""

import json
from pathlib import Path
import requests
import time
from datetime import datetime
from datetime import timedelta

from back.geo_infos.geo_data import enrich_handler
from back.scrapper_licit.licitor_scrapper import (build_soup_session, 
                             extract_announcement_urls, 
                             parse_announcement,
                             build_warnings,
                             save_output)
                             

def run_scrapper(past_dict,
         session,
         request_delay,
         base_url, search_url, 
         output_path, debug_path,
         max_pages = None, max_announces = None, 
         max_pub_dt = None, max_vis_dt = None):

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
    
    """
    urls = ["https://www.licitor.com/annonce/11/01/96/vente-aux-encheres/une-maison-principale/marnes-la-coquette/hauts-de-seine/110196.html",
            "https://www.licitor.com/annonce/11/02/06/vente-aux-encheres/un-immeuble/nevers/nievre/110206.html"]
    urls = ["https://www.licitor.com/annonce/10/97/58/vente-aux-encheres/-/paris-19eme/paris/109758.html"]
    
    
    #TEST ANNONCE AVEC ADJUDICATION DEJA PASSEE
    urls = ["https://www.licitor.com/annonce/10/96/95/vente-aux-encheres/un-appartement/vincennes/val-de-marne/109695.html"]
    
    #MULTI LOTS NON PRIS EN COMPTE -OK MAINTENANT
    urls = ["https://www.licitor.com/annonce/11/00/98/vente-aux-encheres/un-appartement/malaucene/vaucluse/110098.html"]
    
    """
    
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

    """
    save_json(clean_results, output_path)
    save_errors(errors, debug_path)
    save_warnings(warnings, debug_path)
    """

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
    
    return results

def keep_next_selling(past_dict):
    
    now_date = datetime.date(datetime.now())
    out_dict = {}
    
    for ann_id in past_dict.keys():
        bien = past_dict[ann_id]
        dt_vente =  datetime.strptime(bien["dt_vente"], "%Y-%m-%d %H:%M").date()
        raw_visite_dt = bien["visite_dt"]
        if raw_visite_dt == "":
            visite_dt = datetime.now().date() - timedelta(days=1)
        else:
            visite_dt  =  datetime.strptime(bien["visite_dt"], "%Y-%m-%d %H:%M").date()
        if (now_date > visite_dt) and (now_date <= dt_vente):
            bien["visite_dt"] = ""
            out_dict[ann_id] = bien
    
    return out_dict
    
def merge_output(new_dict, past_dict):
    
    past_keys = past_dict.keys()
    new_keys = new_dict.keys()
    for ann_id in past_keys:
        if (ann_id not in new_keys):
            new_dict[ann_id] = past_dict[ann_id]
    return new_dict
    

def scrapper_handler(max_pages, max_announces,
                     max_pub_dt, max_visit_dt,
                     method_key,
                     request_delay = 2.0):

    BASE_URL = "https://www.licitor.com"
    
    #POINT DENTREE SCRAPPING
    URLS_DICT = {
        
            #annonces tri en fonction des dates de publication de la plus recente à la - recente
            "annonces recentes": "https://www.licitor.com/dernieres-encheres.html",
            
            #annonces avec date de visite des plus proches au plus eloigne
            "visites a venir": "https://www.licitor.com/ventes-aux-encheres-immobilieres/visites-sur-place.html"

        }
    
    SEARCH_URL = URLS_DICT[method_key]
    
    #loc_dir = Path(r"C:/Users/benja/Documents/licitor_app/")
    
    try:
        BASE_DIR = Path(__file__).resolve().parents[2]
    except NameError:
        BASE_DIR = Path.cwd() / "Documents" / "licitor_app"
    
    OUTPUT_PATH = BASE_DIR / "front" / "data"
    DEBUG_PATH = BASE_DIR / "tests" / "scrapper_debug"
    
    #OLD DATA
    past_path = OUTPUT_PATH / "auctions.json"
    with open(past_path, "r") as file:
        past_data = json.load(file)
    clean_past = keep_next_selling(past_data)
    
    
    #NEW DATA
    
    session = build_soup_session()
    
    scrapper_out = run_scrapper(clean_past,
         session,
         request_delay,
         BASE_URL, SEARCH_URL, 
         OUTPUT_PATH, DEBUG_PATH, 
         max_pages, max_announces,
         max_pub_dt, max_visit_dt)
    
    return scrapper_out