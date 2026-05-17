import { db, OfflineInventory } from './db';

/**
 * Seeds the Dexie offline database with pre-configured mock inventory datasets.
 * Useful for local sandboxing, manual QA, and alternative medicine margin checking.
 * 
 * @param shopId The shop ID to associate the inventory items with (ensuring cross-tenant isolation).
 */
export async function seedOfflineInventory(shopId: string): Promise<number> {
  // Clear any existing local mock inventory data for safety
  await db.inventory.clear();

  const mockInventory: OfflineInventory[] = [
    {
      id: 'mock-paracetamol-low',
      medicine_name: 'Paracetamol 500mg (Brand A)',
      quantity: 50,
      unit_price: 15,
      purchase_price: 12.5, // Profit = ₹2.50, Margin = 16.6%
      batch_number: 'B-PARA901',
      expiry_date: '2027-12-31',
      rack_number: 'R-01',
      shelf_number: 'S-04',
      generic_name: 'Paracetamol',
      composition: 'Paracetamol 500mg',
      shop_id: shopId,
      is_synced: 1
    },
    {
      id: 'mock-paracetamol-high',
      medicine_name: 'Generic Paracetamol 500mg',
      quantity: 120,
      unit_price: 12,
      purchase_price: 3.5, // Profit = ₹8.50, Margin = 70.8% (Excellent high-margin substitution Candidate)
      batch_number: 'B-GPARA55',
      expiry_date: '2028-06-30',
      rack_number: 'R-02',
      shelf_number: 'S-01',
      generic_name: 'Paracetamol',
      composition: 'Paracetamol 500mg',
      shop_id: shopId,
      is_synced: 1
    },
    {
      id: 'mock-schedule-h1-item',
      medicine_name: 'Alprazolam 0.5mg',
      quantity: 15,
      unit_price: 45,
      purchase_price: 32,
      batch_number: 'B-ALPR11',
      expiry_date: '2027-04-15',
      rack_number: 'R-05',
      shelf_number: 'S-02',
      generic_name: 'Alprazolam',
      composition: 'Alprazolam 0.5mg',
      schedule_h1: true, // Verification target for prescription logs
      shop_id: shopId,
      is_synced: 1
    },
    {
      id: 'mock-out-of-stock-item',
      medicine_name: 'Pantoprazole 40mg (Brand X)',
      quantity: 0, // Out of stock to force AI fallback recommendations
      unit_price: 35,
      purchase_price: 28,
      batch_number: 'B-PANT89',
      expiry_date: '2027-09-22',
      rack_number: 'R-03',
      shelf_number: 'S-03',
      generic_name: 'Pantoprazole',
      composition: 'Pantoprazole 40mg',
      shop_id: shopId,
      is_synced: 1
    },
    {
      id: 'mock-pantoprazole-high-margin',
      medicine_name: 'Generic Pantoprazole 40mg',
      quantity: 80,
      unit_price: 25,
      purchase_price: 8, // Profit = ₹17, Margin = 68% (Excellent match for Brand X above)
      batch_number: 'B-GPANT01',
      expiry_date: '2028-02-15',
      rack_number: 'R-03',
      shelf_number: 'S-05',
      generic_name: 'Pantoprazole',
      composition: 'Pantoprazole 40mg',
      shop_id: shopId,
      is_synced: 1
    }
  ];

  // Bulk add into local IndexedDB
  await db.inventory.bulkAdd(mockInventory);
  
  console.log(`✅ Sandbox Seeder: Successfully injected ${mockInventory.length} offline medicine records into IndexedDB for shop: ${shopId}`);
  
  return mockInventory.length;
}
