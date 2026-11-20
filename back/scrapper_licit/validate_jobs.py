# -*- coding: utf-8 -*-
"""
Created on Wed Nov 18 10:13:27 2026

@author: benja
"""

from back.scrapper_licit.utils import save_output

def validate_announcement(data, mode):
    
    """
    Vérifie la présence des champs importants.
    Retourne une liste de warnings.
    """

    warnings = []
    
    #GLOBALE

    if not data["date_publication"]:
        warnings.append("date_publication manquante")

    if not data["tribunal"]:
        warnings.append("tribunal manquant")

    if not data["type_vente"]:
        warnings.append("type_vente manquant")

    if not data["dt_vente"]:
        warnings.append("dt_vente manquante")
        
    if not data["avocats"]:
        warnings.append("avocat manquant")
        
    #PAR BIEN
        
    if not data["id"]:
        warnings.append("id manquant")

    if data["mise_a_prix"] is None:
        warnings.append("mise_a_prix manquante")

    if not data["ville"]:
        warnings.append("ville manquante")

    if not data["adresse"]:
        warnings.append("adresse manquante")
        
    if not data["coords"]:
        warnings.append("coordonnées géographiques manquantes")
    
    if mode == "VISITE":
        
        if not data["visite"]:
            warnings.append("visite manquant")

    return warnings

def build_warnings(clean_results, mode):
    
    warnings = []
    
    for id_bien in clean_results:
    
        annonce = clean_results[id_bien]
        
        annonce_warnings = validate_announcement(
            annonce, mode
        )

        if annonce_warnings:

            print(
                f"    ⚠️ {len(annonce_warnings)} warning(s)"
            )

            warnings.append({
                "url": annonce["url"],
                "id": annonce["id"],
                "warnings": annonce_warnings,
            })
        
    return warnings


def save_jobs(o_dict, method, params):
    
    results = o_dict["RESULTS"]
    errors = o_dict["ERRORS"]
    warnings = o_dict["WARNINGS"]
    
    warnings = build_warnings(results, method)
    
    save_output(results, params["OUTPUT_FOLDER_PATH"] / params["OUTPUT_FILE_NAME"])
    save_output(errors, params["DEBUG_PATH"] / "errors.json")
    save_output(warnings, params["DEBUG_PATH"] / "warnings.json")
    save_output(o_dict["DOUBLONS"], params["DEBUG_PATH"] / "doublons.json")    


    print()
    print("=" * 50)
    print("RAPPORT DU SCRAPING")
    print("=" * 50)
    
    print(
        f"Méthode : {method}"
    )
    
    print(
        f"Annonces récupérées : {len(results)}"
    )
    
    print(
        f"Erreurs : {len(errors)}"
    )
    
    print(
        f"Annonces avec warnings : {len(warnings)}"
    )
    
    print("=" * 50)