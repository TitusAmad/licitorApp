# -*- coding: utf-8 -*-
"""
Created on Wed Oct  7 14:02:07 2026

@author: benja
"""

from back.scrapper_licit.handling_scrapper import scrapper_handler
from historical_database.manage_bdd import update_sales

#VISITES
new_visits = scrapper_handler("VISITE")

#VENTES
new_sales = scrapper_handler("VENTE")

#IMPORT SALES TO POSTGREE
import_bl = update_sales()

