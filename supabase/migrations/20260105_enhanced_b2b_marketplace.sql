-- Enhanced B2B Marketplace Seed Data
-- Adds comprehensive demo distributors and catalog items

-- 1. Seed Distributors (8 distributors across India)
INSERT INTO public.distributors (name, contact_phone, contact_email, rating, address)
VALUES 
    ('Apollo Wholesalers', '+91-9876543210', 'sales@apollowholesale.in', 4.8, 'Andheri East, Mumbai, Maharashtra'),
    ('MediConnect Hub', '+91-1122334455', 'orders@mediconnect.com', 4.5, 'Connaught Place, New Delhi'),
    ('Global Pharma Supply', '+91-5566778899', 'support@globalpharma.co.in', 4.2, 'Whitefield, Bangalore, Karnataka'),
    ('HealthFirst Distributors', '+91-9988776655', 'info@healthfirst.in', 4.7, 'Salt Lake, Kolkata, West Bengal'),
    ('MedPlus Wholesale', '+91-8877665544', 'wholesale@medplus.net', 4.6, 'Banjara Hills, Hyderabad, Telangana'),
    ('Sunrise Pharma Co.', '+91-7766554433', 'contact@sunrisepharma.com', 4.3, 'Vastrapur, Ahmedabad, Gujarat'),
    ('Prime Medical Supplies', '+91-6655443322', 'sales@primemedical.in', 4.9, 'Viman Nagar, Pune, Maharashtra'),
    ('Universal Drug Depot', '+91-5544332211', 'orders@universaldrug.co.in', 4.4, 'Anna Nagar, Chennai, Tamil Nadu')
ON CONFLICT (name) DO UPDATE SET
    contact_phone = EXCLUDED.contact_phone,
    contact_email = EXCLUDED.contact_email,
    rating = EXCLUDED.rating,
    address = EXCLUDED.address;

-- 2. Seed Comprehensive Catalog Items (27 products across all distributors)
INSERT INTO public.catalogs (distributor_id, drug_name, brand, price, min_order_qty, in_stock)
-- Apollo Wholesalers - General Medicines
SELECT id, 'Paracetamol 500mg', 'Dolo-650', 14.50, 50, true FROM public.distributors WHERE name = 'Apollo Wholesalers'
UNION ALL
SELECT id, 'Amoxicillin 500mg', 'Mox-500', 45.00, 20, true FROM public.distributors WHERE name = 'Apollo Wholesalers'
UNION ALL
SELECT id, 'Azithromycin 500mg', 'Azithral-500', 110.00, 10, true FROM public.distributors WHERE name = 'Apollo Wholesalers'
UNION ALL
SELECT id, 'Ibuprofen 400mg', 'Brufen-400', 18.50, 100, true FROM public.distributors WHERE name = 'Apollo Wholesalers'
UNION ALL

-- MediConnect Hub - Gastro & Allergy
SELECT id, 'Cetirizine 10mg', 'Cetzine', 18.00, 100, true FROM public.distributors WHERE name = 'MediConnect Hub'
UNION ALL
SELECT id, 'Pantoprazole 40mg', 'Pan-40', 85.00, 30, true FROM public.distributors WHERE name = 'MediConnect Hub'
UNION ALL
SELECT id, 'Omeprazole 20mg', 'Omez-20', 72.00, 40, true FROM public.distributors WHERE name = 'MediConnect Hub'
UNION ALL
SELECT id, 'Ranitidine 150mg', 'Aciloc-150', 28.00, 80, true FROM public.distributors WHERE name = 'MediConnect Hub'
UNION ALL

-- Global Pharma Supply - Diabetes & Cardio
SELECT id, 'Metformin 500mg', 'Glycomet-500SR', 22.50, 40, true FROM public.distributors WHERE name = 'Global Pharma Supply'
UNION ALL
SELECT id, 'Atorvastatin 10mg', 'Atorva-10', 75.00, 25, true FROM public.distributors WHERE name = 'Global Pharma Supply'
UNION ALL
SELECT id, 'Glimepiride 2mg', 'Amaryl-2', 95.00, 20, true FROM public.distributors WHERE name = 'Global Pharma Supply'
UNION ALL
SELECT id, 'Amlodipine 5mg', 'Amlip-5', 38.00, 50, true FROM public.distributors WHERE name = 'Global Pharma Supply'
UNION ALL

-- HealthFirst Distributors - Antibiotics & Pain Relief
SELECT id, 'Ciprofloxacin 500mg', 'Ciplox-500', 52.00, 30, true FROM public.distributors WHERE name = 'HealthFirst Distributors'
UNION ALL
SELECT id, 'Diclofenac 50mg', 'Voveran-50', 32.00, 60, true FROM public.distributors WHERE name = 'HealthFirst Distributors'
UNION ALL
SELECT id, 'Tramadol 50mg', 'Ultracet', 125.00, 15, true FROM public.distributors WHERE name = 'HealthFirst Distributors'
UNION ALL

-- MedPlus Wholesale - Vitamins & Supplements
SELECT id, 'Multivitamin', 'Becosules Capsules', 35.00, 100, true FROM public.distributors WHERE name = 'MedPlus Wholesale'
UNION ALL
SELECT id, 'Vitamin D3 60K IU', 'Uprise-D3', 58.00, 50, true FROM public.distributors WHERE name = 'MedPlus Wholesale'
UNION ALL
SELECT id, 'Calcium + Vitamin D', 'Shelcal-500', 48.00, 70, true FROM public.distributors WHERE name = 'MedPlus Wholesale'
UNION ALL

-- Sunrise Pharma Co. - Respiratory & Cough
SELECT id, 'Levocetrizine 5mg', 'Levocet-5', 22.00, 90, true FROM public.distributors WHERE name = 'Sunrise Pharma Co.'
UNION ALL
SELECT id, 'Montelukast 10mg', 'Montair-10', 115.00, 25, true FROM public.distributors WHERE name = 'Sunrise Pharma Co.'
UNION ALL
SELECT id, 'Salbutamol Inhaler', 'Asthalin Inhaler', 180.00, 10, true FROM public.distributors WHERE name = 'Sunrise Pharma Co.'
UNION ALL

-- Prime Medical Supplies - Dermatology & Topical
SELECT id, 'Betamethasone Cream', 'Betnovate-C', 68.00, 40, true FROM public.distributors WHERE name = 'Prime Medical Supplies'
UNION ALL
SELECT id, 'Clotrimazole Cream', 'Candid Cream', 42.00, 60, true FROM public.distributors WHERE name = 'Prime Medical Supplies'
UNION ALL
SELECT id, 'Fusidic Acid Cream', 'Fucidin', 95.00, 20, true FROM public.distributors WHERE name = 'Prime Medical Supplies'
UNION ALL

-- Universal Drug Depot - Antacids & Digestive
SELECT id, 'Domperidone 10mg', 'Domstal-10', 28.00, 80, true FROM public.distributors WHERE name = 'Universal Drug Depot'
UNION ALL
SELECT id, 'Ondansetron 4mg', 'Emeset-4', 45.00, 50, true FROM public.distributors WHERE name = 'Universal Drug Depot'
UNION ALL
SELECT id, 'Loperamide 2mg', 'Eldoper', 38.00, 40, true FROM public.distributors WHERE name = 'Universal Drug Depot'
ON CONFLICT DO NOTHING;
