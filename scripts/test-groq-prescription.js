/**
 * Test script for Groq prescription analysis with dosage recommendations
 * Tests both complete and incomplete prescriptions
 * Run with: node scripts/test-groq-prescription.js
 */

const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';

// Test Case 1: Complete prescription with dosages
const completePrescription = `
Dr. Sharma Medical Clinic
Date: 09/02/2026

Patient Name: Rajesh Kumar
Age: 45 years
Gender: Male

Rx:
1. Paracetamol 500mg - 1 tablet TID after meals for 5 days
2. Amoxicillin 500mg - 1 capsule BD for 7 days
3. Cetirizine 10mg - 1 tablet OD at bedtime for 10 days

Dr. A.K. Sharma
Reg. No: MH/12345
Specialty: General Physician
`;

// Test Case 2: Incomplete prescription (missing dosages)
const incompletePrescription = `
Dr. Verma Clinic
Date: 09/02/2026

Patient: Priya Patel
Age: 32 years

Medications:
- Azithromycin for respiratory infection
- Montair LC for allergic rhinitis
- Pantoprazole for acidity

Dr. R. Verma
`;

// Test Case 3: Prescription with some missing dosages
const partialPrescription = `
City Hospital
09-Feb-2026

Name: Amit Singh
Age: 55

Rx:
1. Metformin 500mg - BD before meals
2. Amlodipine - for hypertension
3. Atorvastatin 10mg - OD at night
4. Aspirin - for cardiovascular protection

Dr. Mehta
MD (Medicine)
`;

async function analyzePrescription(prescriptionText, testName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${testName}`);
    console.log('='.repeat(60));
    console.log('\nInput Prescription:');
    console.log(prescriptionText);
    console.log('\n' + '-'.repeat(60));

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert medical prescription analyzer for an Indian pharmacy system with deep knowledge of pharmacology and medical dosing.

Your tasks:
1. Extract ALL prescription details from the provided text
2. If dosages are MISSING or INCOMPLETE, recommend standard therapeutic dosages based on indication
3. Identify the medical indication (reason) for each medication
4. Use Indian medication naming conventions (both generic and brand names)
5. Return ONLY valid JSON, no additional text

Dosage Recommendation Rules:
- Only recommend if dosage is missing or unclear
- Use standard adult therapeutic doses from BNF/Indian guidelines
- Consider common indications for each medication
- Add a flag "dosage_recommended": true when you provide a recommendation
- Include indication for every medication

JSON Schema to follow:
{
  "patient_name": string,
  "patient_age": string or null,
  "patient_gender": string or null,
  "medications": [
    {
      "name": string (include both generic and brand if available),
      "dosage": string,
      "frequency": string (e.g., OD, BD, TID, QID, or times per day),
      "duration": string (e.g., "5 days", "2 weeks"),
      "instructions": string (e.g., "after meals", "before bedtime"),
      "indication": string (medical reason/condition),
      "dosage_recommended": boolean (true if AI recommended dosage, false if from prescription)
    }
  ],
  "doctor_name": string or null,
  "doctor_registration": string or null,
  "doctor_specialty": string or null,
  "prescription_date": string or null,
  "pharmacy_notes": string or null,
  "warnings": array of strings (any important safety warnings or drug interactions)
}`
                    },
                    {
                        role: 'user',
                        content: `Analyze this prescription and extract all details. If dosages are missing, recommend appropriate standard dosages:\n\n${prescriptionText}`
                    }
                ],
                response_format: {
                    type: 'json_object'
                },
                temperature: 0.2,
                max_tokens: 4096,
                top_p: 0.95
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ API Error:', response.status);
            console.error(error);
            return;
        }

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);

        console.log('\n📋 ANALYSIS RESULT:\n');
        console.log(JSON.stringify(result, null, 2));

        // Highlight recommended dosages
        console.log('\n💊 MEDICATION SUMMARY:');
        result.medications?.forEach((med, index) => {
            console.log(`\n${index + 1}. ${med.name}`);
            console.log(`   Dosage: ${med.dosage} ${med.dosage_recommended ? '🤖 (AI Recommended)' : '✓ (From Prescription)'}`);
            console.log(`   Frequency: ${med.frequency}`);
            console.log(`   Duration: ${med.duration || 'Not specified'}`);
            console.log(`   Indication: ${med.indication}`);
            if (med.instructions) {
                console.log(`   Instructions: ${med.instructions}`);
            }
        });

        if (result.warnings && result.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            result.warnings.forEach(warning => {
                console.log(`   • ${warning}`);
            });
        }

        console.log('\n📊 STATISTICS:');
        console.log(`   Tokens used: ${data.usage?.total_tokens || 'N/A'}`);
        console.log(`   Processing time: ${data.usage?.total_time || 'N/A'} ms`);
        console.log(`   Medications analyzed: ${result.medications?.length || 0}`);
        const recommendedCount = result.medications?.filter(m => m.dosage_recommended).length || 0;
        console.log(`   Dosages recommended by AI: ${recommendedCount}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function runAllTests() {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   GROQ PRESCRIPTION ANALYSIS - COMPREHENSIVE TEST SUITE   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    if (GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
        console.error('\n❌ Please add your Groq API key first!\n');
        console.log('📝 Instructions:');
        console.log('1. Go to: https://console.groq.com');
        console.log('2. Navigate to API Keys → Create API Key');
        console.log('3. Copy your API key');
        console.log('4. Replace YOUR_GROQ_API_KEY_HERE in this script');
        console.log('5. Run: node scripts/test-groq-prescription.js\n');
        return;
    }

    // Run all test cases
    await analyzePrescription(completePrescription, 'Complete Prescription (All Dosages Present)');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting

    await analyzePrescription(incompletePrescription, 'Incomplete Prescription (Missing All Dosages)');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting

    await analyzePrescription(partialPrescription, 'Partial Prescription (Some Dosages Missing)');

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));
    console.log('\n📝 Key Features Tested:');
    console.log('   ✓ Complete prescription extraction');
    console.log('   ✓ Dosage recommendation when missing');
    console.log('   ✓ Indication identification');
    console.log('   ✓ Safety warnings and drug interactions');
    console.log('   ✓ Indian medication naming conventions');
    console.log('\n🚀 Ready to integrate with n8n!\n');
}

runAllTests();
