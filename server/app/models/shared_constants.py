"""
Shared Constants

Common constants used across multiple models/services.
"""

# Top 30 US industries (sorted alphabetically)
INDUSTRIES = sorted([
    {"value": "aerospace_defense", "label": "Aerospace & Defense"},
    {"value": "agriculture", "label": "Agriculture"},
    {"value": "automotive", "label": "Automotive"},
    {"value": "banking", "label": "Banking & Financial Services"},
    {"value": "construction", "label": "Construction"},
    {"value": "consumer_goods", "label": "Consumer Goods & Retail"},
    {"value": "education", "label": "Education"},
    {"value": "energy", "label": "Energy & Utilities"},
    {"value": "entertainment", "label": "Entertainment & Media"},
    {"value": "food_beverage", "label": "Food & Beverage"},
    {"value": "government", "label": "Government & Public Sector"},
    {"value": "healthcare", "label": "Healthcare & Life Sciences"},
    {"value": "hospitality", "label": "Hospitality & Travel"},
    {"value": "insurance", "label": "Insurance"},
    {"value": "legal", "label": "Legal Services"},
    {"value": "logistics", "label": "Logistics & Supply Chain"},
    {"value": "manufacturing", "label": "Manufacturing"},
    {"value": "mining", "label": "Mining & Metals"},
    {"value": "nonprofit", "label": "Nonprofit & NGO"},
    {"value": "pharmaceuticals", "label": "Pharmaceuticals"},
    {"value": "professional_services", "label": "Professional Services"},
    {"value": "real_estate", "label": "Real Estate"},
    {"value": "sports_fitness", "label": "Sports & Fitness"},
    {"value": "technology", "label": "Technology & Software"},
    {"value": "telecommunications", "label": "Telecommunications"},
    {"value": "transportation", "label": "Transportation"},
    {"value": "venture_capital", "label": "Venture Capital & Private Equity"},
    {"value": "waste_management", "label": "Waste Management"},
    {"value": "wholesale", "label": "Wholesale & Distribution"},
    {"value": "other", "label": "Other"},
], key=lambda x: x["label"] if x["value"] != "other" else "zzz")  # Keep "Other" at end
