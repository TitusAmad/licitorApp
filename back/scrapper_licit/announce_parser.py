# -*- coding: utf-8 -*-
"""
Created on Wed Nov 18 10:09:28 2026

@author: benja
"""

from back.scrapper_licit import utils

import re
from datetime import datetime
import requests
import time

def parse_handler(session, request_delay, urls, params):
    
    results = {}
    errors = []
    warnings = []
    dbls = []

    for index, url in enumerate(
        urls,
        start=1,
    ):

        print(
            f"[{index}/{len(urls)}]",
            end = "\n"
        )

        try:
        
            annonce = parse_announcement(session, url, params["DEBUG_PATH"])
        
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
                
    return {"RESULTS": results, 
            "ERRORS": errors,
            "WARNINGS": warnings,
            "DOUBLONS": dbls}

def parse_announcement(session, url, debug_path):
    
    """
    #TEST
    session = utils.build_soup_session()
    url = "https://www.licitor.com/annonce/11/04/28/vente-aux-encheres/un-appartement/vincennes/val-de-marne/110428.html"
    """
    
    print(f"  → {url}")
    
    soup = utils.get_soup(session, url)
    
    # ---------------------------------------------------------
    # PAGE
    # ---------------------------------------------------------
    
    # ---------------------------------------------------------
    # TITRE PAGE
    # ---------------------------------------------------------
    
    page_title = None
    
    title = soup.select_one("#legalad-search h1")

    if title:
        page_title = utils.clean_text(
            title.get_text(" ", strip=True)
            )
        
    
    # ---------------------------------------------------------
    # STATS IMMO PAGE
    # ---------------------------------------------------------
    
    partnerData = soup.select_one(".PartnerOffer")

    # ---------------------------------------------------------
    # CONTENEUR PRINCIPAL DE L'ANNONCE
    # ---------------------------------------------------------

    ad = soup.select_one(".AdContent")

    if not ad:
        print("    ⚠️ Conteneur .AdContent introuvable")
        return None
    
    # ---------------------------------------------------------
    # VARIABLES COMMUNES
    # ---------------------------------------------------------
    
    # ---------------------------------------------------------
    # ID
    # ---------------------------------------------------------

    number = ad.select_one(".Number")
        
    # ---------------------------------------------------------
    # DATE DE PUBLICATION
    # ---------------------------------------------------------

    page_pub = None
    
    publication = ad.select_one(".PublishingDate time")

    if publication:
        page_pub = publication.get("datetime")
        
    # ---------------------------------------------------------
    # TRIBUNAL
    # ---------------------------------------------------------

    page_tribunal = None
    
    court = ad.select_one(".Court")

    if court:
        page_tribunal = utils.clean_text(
            court.get_text(" ", strip=True)
        )

    # ---------------------------------------------------------
    # TYPE DE VENTE
    # ---------------------------------------------------------

    page_type_vente = None
    
    sale_type = ad.select_one(".Type")

    if sale_type:
        page_type_vente = utils.clean_text(
            sale_type.get_text(" ", strip=True)
        )

    # ---------------------------------------------------------
    # DATE / HEURE DE VENTE
    # ---------------------------------------------------------

    page_dt_vente = None
    page_dt_limit = None
    
    page_dt_vente_str = None
    page_dt_limit_str = None
    
    #-1 si vendu et délai 10jours passé ; 1 si vendu mais délai pas passé ; 0 si pas vendu
    sell_state = None
    
    sale_date = ad.select_one(".Date time")

    if sale_date:

        datetime_value = sale_date.get("datetime")

        if datetime_value:

            try:
                dt = datetime.fromisoformat(
                    datetime_value
                )
                
                if number == 110197:
                    print(dt)
                
                limit_out = utils.resell_thresh(dt)
                
                page_dt_limit = limit_out[0]
                page_dt_limit_str = page_dt_limit.isoformat()
                
                sell_state = limit_out[1]

                date_vente = dt.date().isoformat()
                heure_vente = dt.strftime("%H:%M")
                
                page_dt_vente = dt
                page_dt_vente_str = date_vente + " " + heure_vente

            except ValueError:
                # Si jamais le format change,
                # on conserve le texte visible.
                page_dt_vente_str = utils.clean_text(
                    sale_date.get_text(" ", strip=True)
                )

        else:
            page_dt_vente_str = utils.clean_text(
                sale_date.get_text(" ", strip=True)
            )
            
            
    # ---------------------------------------------------------
    # AVOCAT / TÉLÉPHONE
    # ---------------------------------------------------------
    
    lawyers = []
    phones = []

    trusts = ad.find_all("div", attrs={"class":"Trust"})
    
    if trusts:
        
        for trust in trusts:

            lawyer = trust.select_one("h3")
    
            if lawyer:
                lawyer_desc = utils.clean_text(
                    lawyer.get_text(" ", strip=True)
                )
                lawyers.append(lawyer_desc)
    
            trust_text = utils.clean_text(
                trust.get_text(" ", strip=True)
            )
    
            phone_match = re.search(
                r"Tél\.\s*:\s*([0-9 .]+)",
                trust_text,
                flags=re.IGNORECASE,
            )
    
            if phone_match:
                lawyer_phone = utils.clean_text(
                    phone_match.group(1)
                )
                phones.append(lawyer_phone)


    # ---------------------------------------------------------
    # DOCUMENTS
    # ---------------------------------------------------------
    
    page_docs = []

    related = ad.select_one(".Related")

    if related:

        for link in related.select("a"):

            document_type = utils.clean_text(
                link.get_text(" ", strip=True)
            )

            document_url = link.get("href")

            if document_type and document_url:

                page_docs.append({
                    "type": document_type,
                    "url": document_url,
                })
                
    
    # ---------------------------------------------------------
    # BOUCLE MULTI ANNONCES
    # ---------------------------------------------------------
    
    mult_ann = ad.find_all("section", attrs={"class": "AddressBlock"})
    
    all_data = []
    
    lot_count = 0
    
    for i in range(len(mult_ann)):

        block = mult_ann[i]
        
        #VARIABLES LIEES A UNE ADRESSE D'UN BIEN
    
        # ---------------------------------------------------------
        # STATS PRIX
        # ---------------------------------------------------------
            
        partner_stats = None

        if partnerData and i == 0:
            
            partner_stats = utils.extract_partner_stats(partnerData)
        
        # ---------------------------------------------------------
        # LOCALISATION
        # ---------------------------------------------------------
    
        ville_bien = None
        adr_bien = None
        cords_bien = {}
        visite_bien = None
        visite_dt = None
        visite_dt_str = None
        visite_bl = None
            
        location = block.select_one(".Location")
    
        if location:
    
            # -----------------------------------------------------
            # VILLE
            # -----------------------------------------------------
            
            city = location.select_one(".City")
    
            if city:
                ville_bien = utils.clean_text(
                    city.get_text(" ", strip=True)
                )
    
            # -----------------------------------------------------
            # ADRESSE
            # -----------------------------------------------------
            
            street = location.select_one(".Street")
    
            if street:
    
                street_text = utils.clean_text(
                    street.get_text(" ", strip=True)
                )
    
                if street_text:
                    adr_bien = street_text
                    
            # -----------------------------------------------------
            # COORDONNEES GEOGRAPHIQUES
            # -----------------------------------------------------
    
            mapp = location.select_one(".Map")
    
            if mapp:
    
                maps_ref = mapp.find("a",{"class":"Button"}).get("href")
    
                if maps_ref:
                    cords_bien = utils.extract_coordinates(maps_ref)
            
            # -----------------------------------------------------
            # VISITE
            # -----------------------------------------------------
            
            visit = location.select_one(".Visits")
    
            if visit:
                visite_bien = utils.clean_text(
                    visit.get_text(" ", strip=True)
                )
                visite_dt = utils.parse_visite_dt(visite_bien)
                
                if visite_dt is None:
                    visite_bl = -1
                else:
                    visite_dt_str = visite_dt.strftime("%Y-%m-%d %H:%M")
                    if visite_dt >= datetime.now():
                        visite_bl = 1
                    else:
                        visite_bl = 0
            
            else:
                visite_bl = -1
                
                
        #BOUCLE MULTI LOTS SUR UN MEME BIEN

        lots = block.find_all("div", attrs={"class": "Lot"})
        
        for lot in lots: 
            
            lot_count +=1
        
            # ---------------------------------------------------------
            # ADJUST -- ID
            # ---------------------------------------------------------
        
            clean_id = None
        
            if number:
                raw_id = utils.clean_text(
                    number.get_text(" ", strip=True)
                )
                
                id_indx = lot_count - 1
                if id_indx > 0:
                    clean_id = raw_id + f"_{id_indx}"
                else:
                    clean_id = raw_id
            
            # ---------------------------------------------------------
            # MISE À PRIX
            # ---------------------------------------------------------
        
            prix_depart = None
            prix_final = None
            
            price = lot.select_one("h3")
        
            if price:
                prices = utils.handle_prices(lot, price)
                
                mise_obj = prices[0]
                vente_obj = prices[1]
                
                if mise_obj:
                    prix_depart = utils.extract_money(
                        mise_obj.get_text(" ", strip=True)
                    )
                
                if vente_obj:
                    prix_final = utils.extract_money(
                        vente_obj.get_text(" ", strip=True)
                    )
        
            
            # ---------------------------------------------------------
            # FACULTE DE BAISSE
            # ---------------------------------------------------------
        
            baisse_bien = None
            
            addText = lot.find("p", attrs={"class":"AdditionalText"})
        
            if addText:
                raw_txt = str(addText)
                baisse_bien = ("baisse de la mise" in raw_txt)
            

            # ---------------------------------------------------------
            # COMPOSITION DU BIEN
            # ---------------------------------------------------------
            
            types_bien = []
            desc_bien = []
            occupation_bien = None
            surface_bien = None
            
            # -----------------------------------------------------
            # TYPE DU BIEN
            # -----------------------------------------------------
            
            types_bien = utils.extract_type(lot)
            
            # -----------------------------------------------------
            # DESCRIPTION
            # -----------------------------------------------------
            
            desc_bien = utils.extract_description(lot)
            
            # -----------------------------------------------------
            # OCCUPATION
            # -----------------------------------------------------
            
            occupation_bien = utils.extract_occupation(lot)
    
            # -----------------------------------------------------
            # SURFACE
            # -----------------------------------------------------
            
            surface_bien = utils.compute_surface(lot)
            
            #PRIX ESTIME
            
            prix_est = None
            
            if prix_depart:
                prix_est = utils.estimated_price(partner_stats)
        
            # ---------------------------------------------------------
            # AFFECTATION VALEURS
            # --------------------------------------------------------      
            
            data = {
                
                #VARIABLES COMMUNES (MULTI BIENS)
                
                "titre": None,
                "date_publication": None,
                
                "tribunal": None,
                "type_vente": None,
                "dt_vente": None,
                "dt_vente_limit": None,
                "sell_state": None,
                
                "avocats": [],
                "telephones": [],
                "documents": [],
                
                #VARIABLES BIEN
                
                "url": None,
                "id": None,
                
                "mise_a_prix": None,
                "est_price": None,
                "fac_baisse": None,
                "prix_final": None,
                "ville": None,
                "adresse": [],
                "coords": None,
                #calc dans geo
                "trib_anom": None,
                "visite": None,
                "visite_dt": None,
                "visite_state": None,
                
                "type": [],
                "description": [],
                "occupation": None,
                "surface_m2": None,
                
                "stats_bien": None
        
            }
            
            data["titre"] = page_title
            data["date_publication"] = page_pub
            data["tribunal"] = page_tribunal
            data["type_vente"] = page_type_vente
            
            data["dt_vente"] = page_dt_vente_str
            data["dt_vente_limit"] = page_dt_limit_str
            
            data["sell_state"] = sell_state
            
            data["avocats"] = lawyers
            data["telephones"] = phones
            data["documents"] = page_docs
            
            data["url"] = url
            data["id"] = clean_id
            
            data["mise_a_prix"] = prix_depart
            data["est_price_m2"] = prix_est
            data["fac_baisse"] = baisse_bien
            data["prix_final"] = prix_final
            
            data["ville"] = ville_bien
            data["adresse"] = adr_bien
            data["coords"] = cords_bien
            data["visite"] = visite_bien
            data["visite_dt"] = visite_dt_str
            data["visite_state"] = visite_bl
            
            data["type"] = types_bien
            data["description"] = desc_bien
            data["occupation"] = occupation_bien
            data["surface_m2"] = surface_bien
            
            data["stats_bien"] = partner_stats
            
            all_data.append(data)
    
            # ---------------------------------------------------------
            # DEBUG HTML
            # --------------------------------------------------------                
            #save_html(soup, debug_path, data["id"])

    
    return all_data