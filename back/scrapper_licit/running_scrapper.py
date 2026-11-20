# -*- coding: utf-8 -*-
"""
Created on Thu Nov 19 09:33:57 2026

@author: benja
"""

from back.scrapper_licit import utils
from back.scrapper_licit.url_finder import extract_announcement_urls
from back.scrapper_licit.announce_parser import parse_handler
from back.scrapper_licit.validate_jobs import save_jobs
from back.geo_infos.geo_data import enrich_handler


def run_scrapper(method: str, m_params: dict, 
                 request_delay = 2):
    
    """
        method: VISITE | VENTE
    """
    
    print("\n***********", method, "***********", sep = "\n", end = "\n")
    
    """
    1/ RECHERCHE DES URLS DES ANNONCES
    """
    
    session = utils.build_soup_session()
    
    search_urls = m_params["SEARCH_URLS"]
    
    print("\nRecherche des annonces...")
    print(len(search_urls), " liens à scrapper", end = "\n")
    
    urls = []
    
    for search_url in search_urls:
        
        occ_urls = extract_announcement_urls(session,
                              request_delay,
                              m_params["BASE_URL"], search_url, 
                              method,
                              max_pages = m_params["MAX_PAGES"], 
                              max_announces = m_params["MAX_ANNOUNCES"], 
                              max_dt = m_params["MAX_DT"])
        
        print(
            f"\n{len(occ_urls)} annonces trouvées pour le lien suivant:",
            end = "\n"
        )
        print(search_url)
        
        urls.extend(occ_urls)
    
    print(
        f"    {len(urls)} annonces trouvées au total.",
        end = "\n"
    )
    
    """
    2/ PARSING DES ANNONCES
    """
    
    urls = urls[:m_params["MAX_ANNOUNCES"]]
    
    parsing_output = parse_handler(session, request_delay, urls, m_params)
    
    """
    3/ ENRICHISSEMENT DATA GEOGRAPHIQUE
    """
    
    clean_results = enrich_handler(parsing_output["RESULTS"])
    parsing_output["RESULTS"] = clean_results

        
    """
    4/ ENREGISTREMENT JOB
    """
    
    save_jobs(parsing_output, method, m_params)
    
    return clean_results