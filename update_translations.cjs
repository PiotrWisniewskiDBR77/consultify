const fs = require('fs');
const path = require('path');

const extractionPath = path.join(__dirname, 'drd_extraction.json');
const translationPath = path.join(__dirname, 'public/locales/pl/translation.json');

try {
    const extractedData = JSON.parse(fs.readFileSync(extractionPath, 'utf8'));
    const translationData = JSON.parse(fs.readFileSync(translationPath, 'utf8'));

    // Mapping from Excel Area Name to Translation Key Path (relative to assessment.axisContent)
    const areaMapping = {
        // Processes (Axis 1)
        "Sales": "processes.areas.sales",
        "Marketing": "processes.areas.marketing",
        "Production / Operations": "processes.areas.production",
        "Logistics": "processes.areas.logistics",
        "Supplies / Purchasing": "processes.areas.purchasing",
        "Finance & Controlling": "processes.areas.finance",

        // Digital Products (Axis 2)
        "Electronic Products": "digitalProducts.areas.electronic",
        "Community-based Products": "digitalProducts.areas.community",
        "ICT-based Products": "digitalProducts.areas.ict",
        "Product Customization": "digitalProducts.areas.fit",
        "Product Scalability": "digitalProducts.areas.scalability",

        // Business Models (Axis 3)
        "E-commerce Models": "businessModels.areas.ecommerce",
        "Platform Solutions": "businessModels.areas.platform",
        "As-a-Service Models": "businessModels.areas.aas",
        "Asset Sharing Models": "businessModels.areas.sharing",
        "Data Monetization Models": "businessModels.areas.monetization",

        // Data Management (Axis 4)
        "Data Collection": "dataManagement.areas.collection",
        "Data Storage Methodology": "dataManagement.areas.storage",
        "Data Communication": "dataManagement.areas.communication",
        "Big Data Analysis": "dataManagement.areas.analysis",
        "Computing": "dataManagement.areas.computing",

        // Culture (Axis 5)
        "Leadership Attitudes": "culture.areas.leadership",
        "Readiness for Change": "culture.areas.readiness",
        "Continuous Development": "culture.areas.improvement",
        "Culture of Innovation": "culture.areas.innovation",
        "Resource Availability": "culture.areas.resources",

        // Cybersecurity (Axis 6)
        "Strategy & Risk Management": "cybersecurity.areas.strategy",
        "Network & System Protection": "cybersecurity.areas.network",
        "Data Security": "cybersecurity.areas.dataProtection",
        "Education & Training": "cybersecurity.areas.education",
        "Emergency Planning": "cybersecurity.areas.contingency",

        // AI Maturity (Axis 7)
        "7A Data Exposure & AI Foundations": "aiMaturity.areas.data_readiness",
        "7B AI-Augmented Processes": "aiMaturity.areas.deployment",
        "7C AI in Products & Services": "aiMaturity.areas.strategy",
        "7D AI Governance & Ethics": "aiMaturity.areas.governance",
        "7E AI Empowerment of Employees": "aiMaturity.areas.talent"
    };

    const engineModel = extractedData.ENGINE_MODEL || [];
    let updatesCount = 0;

    engineModel.forEach(item => {
        const areaName = item.area_name;
        const targetPath = areaMapping[areaName];

        if (!targetPath) {
            // console.warn(`Skipping unknown area: ${areaName}`);
            return;
        }

        const level = item.stage_number;
        const [axisKey, _, areaKey] = targetPath.split('.');

        // Navigate to the target area object in translationData
        if (!translationData.assessment.axisContent[axisKey]) return;
        if (!translationData.assessment.axisContent[axisKey].areas) return;
        if (!translationData.assessment.axisContent[axisKey].areas[areaKey]) return;

        const areaObj = translationData.assessment.axisContent[axisKey].areas[areaKey];

        // 1. Description
        if (item.description_user_ai) {
            areaObj[`level${level}Desc`] = item.description_user_ai;
        }

        // 2. Helper Questions
        if (item.helper_questions) {
            const questions = item.helper_questions
                .split('\n')
                .map(q => q.replace(/^\*\s*/, '').trim())
                .filter(q => q.length > 0);

            areaObj[`level${level}Questions`] = questions;
        }

        // 3. Formula / Logic
        if (item.decision_or_value_logic) {
            areaObj[`level${level}Formula`] = item.decision_or_value_logic;
        }

        updatesCount++;
    });

    fs.writeFileSync(translationPath, JSON.stringify(translationData, null, 2));
    console.log(`Successfully updated translation.json with ${updatesCount} levels.`);

} catch (error) {
    console.error('Error updating translations:', error);
}
