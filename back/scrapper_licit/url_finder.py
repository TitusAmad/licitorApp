# -*- coding: utf-8 -*-
"""
Created on Wed Nov 18 09:57:59 2026

@author: benja
"""

import requests
import time
from urllib.parse import urljoin, urlparse
from back.scrapper_licit.utils import get_soup, get_max_date

def extract_announcement_urls(session,
                              request_delay,
                              base_url, search_url, 
                              scrap_mode,
                              max_pages = None, max_announces = None, 
                              max_dt = None):
    
    
    """
    Récupère les URLs de toutes les annonces sur plusieurs pages
    à partir d'une oage initiale
    
    Construction URLs en fonction du mode de scrapping
    
    Exemple :
        page 1 : .../prochaines-ventes.html
        page 2 : .../prochaines-ventes.html?p=2
        page 3 : .../prochaines-ventes.html?p=3
    
    La récupération s'arrête lorsqu'une page ne contient
    plus aucune annonce.
    
    max_pages permet éventuellement de limiter le nombre
    de pages parcourues pendant les tests.
    """
    
    #MODE PARAMS
    
    if scrap_mode == "VISITE":
        url_page_operator="?"
    elif scrap_mode == "VENTE":
        url_page_operator="&"
    else:
        print("Mode de scrap inconnu:", scrap_mode, sep="\n")
        return []
        

    urls = []
    page = 1
    
    while True:
    
        # -----------------------------------------------------
        # CONSTRUCTION DE L'URL DE LA PAGE
        # -----------------------------------------------------
    
        if page == 1:
            page_url = search_url
        else:
            page_url = f"{search_url}{url_page_operator}p={page}"
    
        #PAGE PRINCIPALE
        try:
            soup = get_soup(session, page_url)
    
        except requests.RequestException as error:
    
            print(
                f"  ⚠️ Erreur lors du chargement de la page : {error}"
            )
    
            break
        
        #MAX PAGES
        if page == 1 and max_pages == None:
            
            obj = soup.find("span", attrs={"class": "PageTotal"})
            raw_pages = obj.get_text(" ", strip = True).split("/")[1].strip()
            try:
                max_pages = int(raw_pages)
                print("\nMax Pages:", max_pages)
            except:
                print("\nMax Pages introuvable - Pas de Scrap", page_url, sep = "\n")
                break
            
        #GET MAX_DATE
        if not max_dt is None:
            page_max_date = get_max_date(soup, scrap_mode)
            if scrap_mode == "VISITE":
                cond_bl = False
            elif scrap_mode == "VENTE":
                cond_bl = (page_max_date < max_dt)
            if cond_bl:
                print("\nDate Max atteinte - Fin scrapping", f"Page {page}", f"Page Max Date: {page_max_date}", f"User Max Date: {max_dt}", sep = "\n")
                break
            
            
        print(
            f"\nRecherche des annonces - page {page}"
        )
        print(
            f"  → {page_url}"
        )
            
        # -----------------------------------------------------
        # RÉCUPÉRATION DES URLS
        # -----------------------------------------------------
    
        page_urls = []
        
        links = soup.find_all("a", href=True)
    
        for link in links:
    
            href = link["href"]
    
            absolute_url = urljoin(
                base_url,
                href,
            )
    
            parsed = urlparse(
                absolute_url
            )
    
            # Une annonce Licitor contient /annonce/
            if "/annonce/" not in parsed.path:
                continue
                
            # Évite les doublons sur la page.
            if absolute_url not in page_urls:
                
                page_urls.append(
                    absolute_url
                )

    
        # -----------------------------------------------------
        # FIN DE LA PAGINATION
        # -----------------------------------------------------
    
        if not page_urls:
    
            print(
                f"  → Aucune annonce trouvée sur la page {page}."
            )
    
            break
    
        # -----------------------------------------------------
        # AJOUT DES URLS
        # -----------------------------------------------------
    
        new_urls = 0
    
        for url in page_urls:
    
            if url not in urls:
    
                urls.append(url)
    
                new_urls += 1
    
        print(
            f"  → {len(page_urls)} annonces trouvées "
            f"({new_urls} nouvelles)"
        )
    
        # -----------------------------------------------------
        # LIMITE OPTIONNELLE DU NOMBRE DE PAGES
        # -----------------------------------------------------
    
        if max_pages is not None and page >= max_pages:
    
            print(
                f"\nLimite de {max_pages} page(s) atteinte."
            )
    
            break
        
        # -----------------------------------------------------
        # LIMITE OPTIONNELLE DU NOMBRE D'ANNONCES
        # -----------------------------------------------------
        
        nbr_announces = len(urls)
    
        if max_announces is not None and nbr_announces >= max_announces:
    
            print(
                f"\Limite de {max_announces} annonce(s) atteinte."
            )
    
            break
    
        page += 1
    
        # Pause entre les pages de recherche.
        time.sleep(request_delay)
    
    return urls