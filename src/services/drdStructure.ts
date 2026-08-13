/**
 * DRD (Digital Readiness Diagnosis) Structure
 *
 * Complete structure based on "Digital Pathfinder" by Dr. Piotr Wisniewski
 * 7 Axes of Digital Transformation with 34 assessment areas total
 *
 * Structure:
 * - Axis 1: Digital Processes (9 areas, 7 levels)
 * - Axis 2: Digital Products (5 areas, 5 levels)
 * - Axis 3: Digital Business Models (5 areas, 5 levels)
 * - Axis 4: Data Management (5 areas, 7 levels)
 * - Axis 5: Culture of Transformation (5 areas, 6 levels)
 * - Axis 6: Cybersecurity (5 areas, 6 levels)
 * - Axis 7: AI Maturity (5 areas, 5 levels)
 */

export interface DRDLevel {
  level: number;
  title: string;
  description: string;
}

export interface DRDArea {
  id: string; // e.g. "1A"
  name: string;
  namePL?: string;
  levels: DRDLevel[];
}

export interface DRDAxis {
  id: number;
  name: string;
  namePL?: string;
  description?: string;
  levelCount: number; // 5 or 7 depending on axis
  areas: DRDArea[];
}

// ============================================
// AXIS 1: DIGITAL PROCESSES (9 areas, 7 levels)
// ============================================

const AXIS_1_PROCESSES: DRDAxis = {
  id: 1,
  name: 'Digital Processes',
  namePL: 'Procesy Cyfrowe',
  description: 'Assessment of digital transformation across core business processes',
  levelCount: 7,
  areas: [
    {
      id: '1A',
      name: 'Sales Processes',
      namePL: 'Procesy Sprzedaży',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'Sales employees use dedicated systems to electronically register agreements and orders. This level ensures the precise documentation and efficient storage of crucial data.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'There is a reporting system that allows the monitoring and analysis of sales-related data. The reporting tool automatically generates reports containing key sales indicators and statistics, facilitating decision-making.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'Budget control is implemented within the sales process through automation. An appropriate system enables the planning and control of the sales budget. The system generates the budget based on predefined parameters and sales indicators, streamlining financial management.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'We use various tools to automate sales such as online shops, marketplaces or a DIY platform that allow customers to buy online without having to interact with our employees.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'Manufacturing Execution Systems are used for reporting in the sales process. These systems enable the monitoring and analysis of data related to deliveries and logistics. They generate reports on deliveries, track delivery statuses and provide information on shipments and delivery deadlines.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'Integrated ERP (Enterprise Resource Planning) solutions are used within the sales process. This comprehensive system encompasses the management of key business processes, including sales. It synchronizes sales processes with other areas of the organization, such as procurement, production and finance.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'We harness advanced algorithms within the sales process to personalize offerings and provide other advanced features. Of note here are offer-personalization algorithms to analyse customer preferences and generate personalized purchase suggestions. We also employ natural language processing technology for customer service and tools for the automated operation of sales bots.',
        },
      ],
    },
    {
      id: '1B',
      name: 'Marketing Processes',
      namePL: 'Procesy Marketingowe',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'The key feature of digitalization here is a CRM (Customer Relationship Management) system to register and manage basic customer data. It gathers contact details, precise interaction histories and marketing preferences, which are the basis for further marketing operations.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'The marketing domain leverages CRM tools in conjunction with key analytical indicators to assess the effectiveness of marketing operations. Integrating CRM systems with analytical tools enables precise analysis and monitoring of key marketing indicators for well-informed decision-making.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'Tools related to search engine optimization (SEO) and data analysis from Google Analytics are employed. This provides oversight of marketing processes and the ability to assess the effectiveness of online activities. SEO strategies raise the visibility of websites in search results, while data from Google Analytics enable the monitoring of website traffic and user behaviours.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'We use e-marketing tools to automate, for example, the sending of newsletters, email campaigns and offer personalization. E-marketing platforms automate campaigns based on predefined scenarios and customer segmentation, significantly enhancing the efficiency of marketing efforts.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'Manufacturing Execution Systems are used to measure conversion in the sales process and evaluate the quality of marketing activities. In the marketing context, MES tools track conversions at various stages of the sales funnel and assign scores to potential customers (leads) based on their activities and behaviours.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'Marketing harnesses integrated Enterprise Resource Planning solutions to manage key processes. An ERP system integrates marketing processes with other areas of the organization, allowing for efficient campaign management, customer data management and performance analysis.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'We assess the extent to which advanced algorithms are used in marketing. Technologies such as chatbots and content generation based on natural language processing (NLP) support customer interaction and the creation of personalized content. Chatbots provide rapid responses to customer inquiries, while NLP algorithms deliver personalized information, significantly improving customer service quality and raising audience engagement.',
        },
      ],
    },
    {
      id: '1C',
      name: 'Process Technology and R&D',
      namePL: 'Technologia Procesowa i R&D',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'Design tools such as CAD record precise basic data on technological solutions that have been designed.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'In the technology field, digital simulation tools enable control over workstations and technological processes. Through process simulation software or equipment operation simulations, the efficiency of technological workstations can be analysed and controlled.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'Failure Mode and Effects Analysis (FMEA) is applied, which allows the control of technological processes and the identification of potential errors and their consequences, and thus the development of preventive action plans.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'Various automation technologies such as 3D printing, virtual reality (VR) or augmented reality (AR) are in use. These allow prototypes to be created and tested and technological processes to be improved. 3D printing enables rapid prototyping and design verification, while VR/AR technologies support process simulation and employee training.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'Manufacturing Execution Systems are used to manage technological projects and monitor their implementation. MESs aid in planning, monitoring and managing technological projects, including task scheduling, resource allocation, progress control and reporting. In the development of manufacturing technologies, a Digital Twin is an MES-class tool.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'Integrated Enterprise Resource Planning solutions manage key business processes, including technological processes. An integrated ERP system enables the management of technological processes, task scheduling, progress monitoring and integration with other areas of operation. Integrating the technological process with the ERP system also allows the exchange of data on technological cycle times, which is particularly useful during the design, price quoting and execution of new projects.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'Technologies such as AI algorithms support developmental work and the optimization of technological processes. These algorithms analyse data, optimize technological processes, generate proposals for improvements and automate actions, leading to efficiency and innovation in technological operations. AI can assist in identifying promising research areas, further expediting the innovation process and the development of new technologies.',
        },
      ],
    },
    {
      id: '1D',
      name: 'Purchasing Processes',
      namePL: 'Procesy Zakupowe',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'Basic transaction data are digitally recorded and stored, such as data about suppliers, products, quantities and prices. This level is fundamental because it ensures consistent and precise transaction information.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'Inventory planning tools, such as Material Requirements Planning (MRP), control material availability. These tools are used in establishing optimal ordering plans to ensure that there is always adequate availability of materials.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'An automated workflow system manages and controls the entire purchasing process, from the moment an order is placed, through its internal approval within the organization, to its execution and settlement. This makes procurement processes more efficient by automating their monitoring and management.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'We utilize B2B procurement and auction platforms that enable electronic order placement, price negotiations, supplier offer comparisons and the efficient management of procurement relationships. This level provides more efficient procurement processes that are better integrated with suppliers.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'MES-class systems enable the monitoring of purchasing-related KPIs. Metrics such as procurement costs, delivery times, delivery quality and the effectiveness of price negotiations are closely monitored. This level makes procurement processes more transparent and controlled.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'Integrated Enterprise Resource Planning systems encompass the management of key business processes, including procurement processes. This allows us to schedule orders, monitor deliveries, process payments and integrate procurement processes with other areas of company operations.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'Advanced predictive algorithms are applied to support pricing and price negotiation processes. These algorithms analyse the market, forecast commodity and component prices, and support negotiations with suppliers. This level makes procurement processes more intelligent and adaptable to changes in the commercial landscape.',
        },
      ],
    },
    {
      id: '1E',
      name: 'Logistics Processes',
      namePL: 'Procesy Logistyczne',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'We employ RFID or barcode scanners that allow the registration of data related to material location and identification. These scanners quickly read the labels on goods in the warehouse to precisely identify them and record their locations.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'We use real-time location in the system and mobile terminals to control and monitor logistics stations. Employees can thus track and update the location and condition of goods in the warehouse.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'A Warehouse Management System (WMS) and Electronic Data Interchange (EDI) are used over the Internet. This facilitates control and management of the logistics process at a higher level. The WMS system supervises the flow of materials in the warehouse, while EDI streamlines electronic data exchange with business partners to enhance logistics processes.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'We use Automated Guided Vehicles (AGVs) that can independently move goods within the warehouse. Meanwhile, robotized order-picking and other robotic operations automate or assist in many logistics operations, such as loading and unloading.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'MES-class systems and an advanced Warehouse Management System (WMS) integrated with Milkrun or Kanban systems monitor and optimize logistics processes. The MES system integrates production and warehouse management, while the WMS system, combined with Milkrun and Kanban, helps optimize inventory management and internal transport services.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'Integrated ERP systems encompass the management of key business processes, including logistics processes. This allows us to manage logistics processes such as tracking goods, warehouse management, order management and integration with other areas of company operations.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'AI algorithms support the optimization of inventory levels and the allocation of goods within the warehouse. These advanced algorithms analyse demand, forecast needs, optimize inventory levels and assist in optimizing the placement of goods in the warehouse, thereby increasing operational efficiency and accelerating responses to changing external and internal circumstances.',
        },
      ],
    },
    {
      id: '1F',
      name: 'Production Processes',
      namePL: 'Procesy Produkcyjne',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'A precise monitoring and recording system gathers basic data from production machines and equipment. Those data include machine runtimes, technical parameters, performance and product quality.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'Programmable Logic Controllers (PLCs), sensors and detectors are employed to control and monitor production stations. PLCs, sensors and detectors monitor process parameters such as temperature, pressure and speed, and they control the operation of machines and equipment.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'Advanced systems are applied, including Computerized Maintenance Management Systems (CMMS), Overall Equipment Effectiveness (OEE) analysis, and Value Stream Mapping (VSM). These help control and optimize the production process. The CMMS system aids in planning and monitoring machine maintenance; OEE analysis evaluates equipment efficiency; and VSM allows production process parameters to be visually represented.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'Automation and robotization of production operations increase productivity and precision. Automation encompasses the use of industrial robots and automation systems for repetitive tasks, eliminating human errors and enhancing efficiency.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'Manufacturing Execution Systems are employed on production lines. MES systems include real-time management and control of production processes. This includes production planning, order management, material tracking, quality control and reporting on production lines.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'The key business processes that integrated ERP solutions manage include production. ERP systems integrate production management, resource planning, purchasing, sales and other processes to optimize the production process through efficient resource management.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'AI algorithms optimize production plans, precisely schedule tasks at individual workstations, and facilitate the even distribution of loads on production lines (including based on data acquired from digital twin simulations), thereby increasing efficiency and production flexibility.',
        },
      ],
    },
    {
      id: '1G',
      name: 'Quality Processes',
      namePL: 'Procesy Jakości',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'Electronic compliance sheets are used to record basic data related to product quality. These electronic sheets contain information about quality parameters, measurement results, tests and other quality-related data.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'Quality control systems embedded in machines and equipment are used in the production process. These systems allow for real-time monitoring of quality parameters such as dimensions, surface features, or other critical characteristics. Cameras, sensors and analysers are used for automatic quality control.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'A central system responds to quality defects. It quickly identifies, responds to and eliminates quality defects in the production process by automatically detecting defects, generating alerts, informing relevant personnel and initiating corrective actions for improved product quality.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'Robots and advanced vision systems are employed for precise automatic examination of product quality. These systems can analyse defects, dimensions and surface characteristics and can eliminate human errors to ensure consistent quality.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'A Quality Management System (QMS) controls and monitors product quality at various stages of production. This includes document management, quality planning and control, and tracking of tests and inspections, as well as reporting on product quality and process stability.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'Integrated ERP solutions are applied that encompass quality management in the production process and that integrate this information with other areas of business operations. ERP systems integrate quality management, documentation, process control, customer complaint handling and other quality-related functions.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'AI algorithms determine the scope of quality control in the production process for efficient and precise management of the quality control process. These algorithms use data analysis and product quality histories to automatically determine which production batches require detailed quality control.',
        },
      ],
    },
    {
      id: '1H',
      name: 'Financial Management',
      namePL: 'Zarządzanie Finansami',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'Technologies such as OCR and electronic document management are used to record basic data such as invoices, contracts and other financial documents. OCR technology automatically extracts data from invoices and electronic document management to accelerate and streamline the recording of financial data.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'Financial control (FC) tools and systems such as financial management systems monitor and control financial indicators and financial reporting. FC systems analyse and control budgets, costs, profitability and other financial indicators.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'Decision acceptance systems coordinate and control financial decision-making processes. This improves information flow, risk assessment and the approval and monitoring of financial decisions at various levels of the organizational hierarchy.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'Robotic Process Automation (RPA) automates processes for automatic and efficient execution of repetitive tasks. RPA technology is used for tasks such as automatic invoice processing, report generation and financial analysis.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'Workflow Management Systems optimize financial processes and control and track the progress of tasks. They automate and enhance financial processes such as payment approval, order management and cost reconciliation.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'Integrated ERP solutions provide financial control within the organization, process integration and real-time access to financial data.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'AI algorithms and Business Intelligence (BI) tools are utilized for financial data analysis, report generation, forecasting and making advanced financial decisions.',
        },
      ],
    },
    {
      id: '1I',
      name: 'HR Processes',
      namePL: 'Procesy HR',
      levels: [
        {
          level: 1,
          title: 'Basic Data Registration',
          description:
            'Electronic work cards are used to register basic HR data such as work hours, employee presence and other time-management-related information.',
        },
        {
          level: 2,
          title: 'Workstation Control',
          description:
            'Systems engage in payroll management, overseeing salary data, payroll lists, tax declarations and other aspects of human resource management.',
        },
        {
          level: 3,
          title: 'Process Control',
          description:
            'Systems are used that register work time and attendance so that employees can automatically record their work hours using various technologies such as proximity cards, biometric readers or mobile applications.',
        },
        {
          level: 4,
          title: 'Automation',
          description:
            'HR processes are automated using e-kiosks and web applications that allow employees to independently manage their data, request leave, access documents and perform HR-related tasks.',
        },
        {
          level: 5,
          title: 'MES',
          description:
            'Comprehensive Human Resource Management (HRM) software records personal data and employee assessments, and it is used in planning training, monitoring salaries and benefits, and career management.',
        },
        {
          level: 6,
          title: 'ERP',
          description:
            'An integrated ERP system with HR modules is used to centralize human resource management data.',
        },
        {
          level: 7,
          title: 'AI Support',
          description:
            'AI algorithms support recruitment processes, talent management, HR data analysis and employee development planning.',
        },
      ],
    },
  ],
};

// ============================================
// AXIS 2: DIGITAL PRODUCTS (5 areas, 5 levels)
// ============================================

const AXIS_2_PRODUCTS: DRDAxis = {
  id: 2,
  name: 'Digital Products',
  namePL: 'Produkty Cyfrowe',
  description: 'Assessment of digital product offerings and their sophistication',
  levelCount: 5,
  areas: [
    {
      id: '2A',
      name: 'Digital Products',
      namePL: 'Produkty Cyfrowe',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'Products such as e-books, audiobooks or movies can be easily downloaded or streamed from online platforms like Amazon and Audible. For example, a customer purchases an e-book from a website and downloads it to their e-reader device.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'Products that combine multiple formats such as multimedia, e-books, audio and video are available on various devices or platforms, such as streaming platforms like Netflix. A website offers a multimedia package containing e-books, audio and video that can be played on different devices.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'Electronic products with additional features, such as mobile apps, games or software offer added functionality like personalization, user interaction or artificial intelligence. A mobile app allows users to customize settings and engage with other users.',
        },
        {
          level: 4,
          title: 'Interactive',
          description:
            "Products that offer interactivity, such as many video games, virtual reality, educational apps or design tools that enable users to actively collaborate or modify the product. Many video games allow users to interact with a virtual environment and make decisions that affect the game's progress.",
        },
        {
          level: 5,
          title: 'Expert',
          description:
            'Products leverage cutting-edge technologies like artificial intelligence, machine learning and blockchain to deliver more advanced products, such as intelligent data analysis systems, enterprise software or virtual reality platforms. Online services like e-learning platforms or cloud services also fit into this level.',
        },
      ],
    },
    {
      id: '2B',
      name: 'Community-based Products',
      namePL: 'Produkty Społecznościowe',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'An online community shares resources such as files, tools or information. Users can collectively utilize these resources and support each other by sharing knowledge and experiences. A community of photographers, for example, share their photos on an online platform, allowing other users to download and use them.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'An online community actively collaborates and interacts while working on projects, discussions and problem-solving. Users engage in group activities and share ideas, opinions and comments. A platform for developers, for example, enables collaborative work on projects, sharing code, commenting and mutual assistance.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'This level focuses on experts sharing knowledge and expertise and mentoring other community members. Users can receive advice and support from more experienced individuals in their field. A community of programmers, for example, offers mentoring and provides educational materials for beginners in programming.',
        },
        {
          level: 4,
          title: 'Interactive',
          description:
            'The online community actively contributes to creating content such as designs, articles, videos or graphics. Users can collaborate in creating something new, shared and creative. A community of artists, for example, collaborates on an artistic project, combining their skills in various art forms.',
        },
        {
          level: 5,
          title: 'Expert',
          description:
            "This highest level is based on community members' involvement in co-owning and influencing the community's development and the products or services it includes. Users can participate in decision-making, express opinions and influence the community's direction. The user community of a social media platform, for example, influences the platform's features, design and improvements by actively suggesting ideas and voting on them.",
        },
      ],
    },
    {
      id: '2C',
      name: 'ICT-based Products',
      namePL: 'Produkty ICT',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            "ICT is used for collecting, processing and analysing customer data. These data may include preferences, behaviours, purchase histories and other information that helps better understand customers. An analytical platform tracks user interactions on an online store's website.",
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'ICT enables the personalization of offers to customers based on collected data. Advanced algorithms and analytical tools create personalized recommendations, offers and user experiences. An example of ICT use for personalization is a product recommendation system in an online store.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'ICT is employed to facilitate communication and interaction with customers. Tools such as communication platforms, customer support systems and chatbots allow rapid and efficient information exchange. An example of effective ICT use for communication with customers is an integrated customer support platform that combines various communication channels in one place.',
        },
        {
          level: 4,
          title: 'Interactive',
          description:
            'ICT is used to automate and personalize customer service processes. Advanced Customer Relationship Management (CRM) systems and marketing automation tools deliver messages, offers and responses all personalized to customer needs. An example of using ICT for automating and personalizing customer service processes is an advanced CRM system integrated with marketing automation tools.',
        },
        {
          level: 5,
          title: 'Expert',
          description:
            'At the highest level, ICT serves as a tool for innovation and product improvement. Technologies such as big data, artificial intelligence, machine learning and predictive analysis are used to generate new ideas, discover trends and create innovative products that better meet customer expectations.',
        },
      ],
    },
    {
      id: '2D',
      name: 'Product Alignment to Customer Expectations',
      namePL: 'Dopasowanie Produktu do Oczekiwań Klienta',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            "The product is available through various sales and communication channels, providing customers with consistent experiences, regardless of where and how they engage with it. For example, an e-commerce company collects data on customers' purchasing preferences and analyses them to customize product offerings and recommendations.",
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            "The product is tailored to different market segments, considering the unique needs and preferences of each customer group to deliver personalized and appealing solutions. In a typical example, a streaming platform adjusts movie and show recommendations based on the viewer's preferences.",
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'The product uses flexible pricing models that adjust to changing market conditions, customer preferences and competition, ensuring optimal value for different audience groups. The company employs a communication platform that allows customers to contact customer support through live chat.',
        },
        {
          level: 4,
          title: 'Interactive',
          description:
            "The product customizes experiences to individual customer needs, preferences and history by personalizing content, features and recommendations. The company sends automated emails with product offers and recommendations tailored to the customer's preferences.",
        },
        {
          level: 5,
          title: 'Expert',
          description:
            "The product is customized and manufactured to the customer's order, allowing the customer to tailor it to individual requirements and preferences, leading to greater satisfaction and alignment. The company uses predictive analysis and machine learning to create innovative products that respond as customer needs evolve.",
        },
      ],
    },
    {
      id: '2E',
      name: 'Product Scalability',
      namePL: 'Skalowalność Produktu',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'The product is developed and offered locally, focusing on a narrow audience or regional market. There are no opportunities for expansion into other markets. For example, a food ordering mobile app that operates in only one city.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'The product gains popularity in a specific region and starts expanding into adjacent markets. This may involve expansion into countries with similar preferences and needs. An example is a streaming service available in several countries in the Central and Eastern European region.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'The product leverages global platforms and services such as e-commerce platforms, social networks or cloud services to reach customers in different markets. The product is accessible to customers from various countries but may require some adaptation to local preferences.',
        },
        {
          level: 4,
          title: 'Interactive',
          description:
            'The product has a presence in multiple international markets and is adapted to various regions. This may include content translation, user interface customization and compliance with local regulations and standards. An example is an e-commerce website available in different languages and supporting various currencies and payment methods.',
        },
        {
          level: 5,
          title: 'Expert',
          description:
            'The product is globally accessible with no geographical constraints. It is widely recognized and used in various markets worldwide. It is customizable to different cultures and languages and complies with local regulations and requirements. This is perhaps best exemplified by a social networking platform that is available worldwide and supports multiple languages and cultural variations in user behaviours.',
        },
      ],
    },
  ],
};

// ============================================
// AXIS 3: DIGITAL BUSINESS MODELS (5 areas, 5 levels)
// ============================================

const AXIS_3_BUSINESS_MODELS: DRDAxis = {
  id: 3,
  name: 'Digital Business Models',
  namePL: 'Cyfrowe Modele Biznesowe',
  description: 'Assessment of digital business model adoption and innovation',
  levelCount: 5,
  areas: [
    {
      id: '3A',
      name: 'E-commerce Models',
      namePL: 'Modele E-commerce',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'Online stores offer products or services through their own websites or popular e-commerce platforms like Amazon or eBay. Customers can choose from a variety of products, such as clothing, electronics or cosmetics, and make online purchases. This process involves adding products to a cart and making payments. Companies utilize basic sales applications to manage orders and track sales.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'An essential step is integration with various e-commerce platforms to enhance the visibility of products on various platforms. Additionally, sales applications offer more advanced tools such as inventory management and sales data analysis. The importance of offer personalization is greater at this level, and products can be tailored to individual needs.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'E-commerce stores continue to enhance their capabilities through further integration with various platforms, including marketplaces. More advanced visualization tools allow customers to, for example, view products in different colours or configurations. The personalizing of offers is more advanced at this stage, relying on customer purchase data and enabling customization.',
        },
        {
          level: 4,
          title: 'Advanced Personalization',
          description:
            "Internet stores reach for even more advanced visualization tools and sales applications that allow for full customization of offers. Integrated e-commerce platforms are more comprehensive, enabling the sale of products on multiple platforms simultaneously. At this level, personalization becomes a key element of the business strategy, facilitating the adaptation of offers to each customer's individual preferences.",
        },
        {
          level: 5,
          title: 'Expert',
          description:
            'E-commerce harnesses the latest technologies such as artificial intelligence, blockchain and the Internet of Things. Product visualization can include advanced virtual reality technologies, providing customers with incredibly realistic online shopping experiences. Integrations with marketplaces are highly comprehensive, allowing for product sales on various platforms simultaneously.',
        },
      ],
    },
    {
      id: '3B',
      name: 'Platform Solutions',
      namePL: 'Rozwiązania Platformowe',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'An individual or company uses a platform to conduct simple transactions, such as purchasing or selling products or services. For example, a company might use a B2B platform to optimize raw material purchases or to forecast prices.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'A company or institution provides a platform where sellers can offer products or services to customers. The platform may offer analytical tools to sellers and personalized recommendations to customers. An online gaming platform, for example, might provide access to games through a subscription or one-time payment.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'A company or institution creates and manages an ecosystem, connecting suppliers, partners and customers to create added value and synergy. They offer market analysis tools, joint promotions and loyalty programmes. An example might be an e-commerce platform integrating suppliers, partners and customers while also offering market analysis.',
        },
        {
          level: 4,
          title: 'Advanced SEM',
          description:
            'In addition to facilitating transactional relationships, the owner provides Software-as-a-Service solutions on its platform, enabling access to various online applications and tools. This type of platform organization is referred to as a Software-as-a-Service Enabled Marketplace (SEM). SEM platforms offer diverse applications, from project management to data analysis, with the option for customization and integration.',
        },
        {
          level: 5,
          title: 'Expert',
          description:
            'The highest-level platforms combine the functionalities of SEM platforms with an active user community. This enables participants to interact, collaborate and share knowledge. Companies combine SEM platforms with forums and chats where users can share knowledge and resolve issues.',
        },
      ],
    },
    {
      id: '3C',
      name: 'As-a-Service',
      namePL: 'Model As-a-Service',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'The company and its service provider enter into long-term service agreements that resemble traditional partnerships. The provider offers a basic service with an emphasis on availability and simplicity. The customer values the convenience and flexibility of using the service, even though the service does not solve complex business problems.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'The company and the service provider establish long-term subscription or tariff-based agreements for service usage. The provider offers more advanced features and technical support. The customer expects consistent service quality throughout the contract period.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            "The customer pays the service provider for the time they use available assets or resources. The service provider focuses on managing and maintaining assets for the customer's needs, providing greater flexibility.",
        },
        {
          level: 4,
          title: 'Advanced Personalization',
          description:
            "The customer pays a service provider to complete specific tasks or achieve precisely defined results. The provider adapts heavily to the customer's individual needs and delivers personalized solutions. The customer expects a specialized and tailored approach from the provider.",
        },
        {
          level: 5,
          title: 'Expert',
          description:
            "Service providers act as the primary executor, managing the entire customer business process. The customer leverages comprehensive business solutions offered by the provider. This is the highest level of provider involvement in the customer's business processes.",
        },
      ],
    },
    {
      id: '3D',
      name: 'Asset Sharing Models',
      namePL: 'Modele Współdzielenia Zasobów',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'The platform allows users to share virtual assets such as files, digital content, applications or online services. Users can use these assets based on subscriptions, pay-per-use or platform access.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'The platform enables users to share physical assets such as cars, properties, tools or equipment. Users can rent these assets from others for a specified duration, allowing them to save on purchasing or renting a full set of items.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'The platform allows users to share knowledge, skills, experience or the product of intellectual work. Users can offer their services, conduct training or share educational materials with other platform users.',
        },
        {
          level: 4,
          title: 'Advanced Personalization',
          description:
            "The customer pays the service provider for the time they use available assets or resources. The service provider focuses on managing and maintaining assets for the customer's needs in order to increase the customer's flexibility.",
        },
        {
          level: 5,
          title: 'Expert',
          description:
            'The platform enables users to share complex business solutions such as IT infrastructure, analytical tools, logistics services or project management. Users can use these solutions on a subscription or pay-per-use basis, allowing them to reduce the costs of their investments.',
        },
      ],
    },
    {
      id: '3E',
      name: 'Data Monetization Models',
      namePL: 'Modele Monetyzacji Danych',
      levels: [
        {
          level: 1,
          title: 'Basic',
          description:
            'The company collects data from its customers, such as preferences, shopping behaviour and demographic information. It uses the data to comprehend customers and enhance its offerings.',
        },
        {
          level: 2,
          title: 'Intermediate',
          description:
            'The company conducts more advanced analysis of the accumulated data to identify patterns, trends and opportunities. Data analysis helps it understand customers and make more informed business decisions.',
        },
        {
          level: 3,
          title: 'Advanced',
          description:
            'The company employs the gathered data to personalize offerings to individual customers. This allows it to deliver customized products, services and content that align more closely with individual customer needs and preferences.',
        },
        {
          level: 4,
          title: 'Advanced Personalization',
          description:
            'The company uses the accumulated data as a valuable resource that can be sold, shared or used to generate additional revenue. This may involve sharing data with business partners, offering paid analytical services, or using data for advertising purposes.',
        },
        {
          level: 5,
          title: 'Expert',
          description:
            'The company uses its gathered data to create new products, services and innovative solutions. Data serve as the foundation for developing new business models, crafting intelligent algorithms and harnessing artificial intelligence to deliver more advanced solutions to customers.',
        },
      ],
    },
  ],
};

// ============================================
// AXIS 4: DATA MANAGEMENT (5 areas, 7 levels)
// ============================================

const AXIS_4_DATA_MANAGEMENT: DRDAxis = {
  id: 4,
  name: 'Data Management',
  namePL: 'Zarządzanie Danymi',
  description: 'Assessment of data collection, storage, analysis and utilization capabilities',
  levelCount: 7,
  areas: [
    {
      id: '4A',
      name: 'Data Collection',
      namePL: 'Zbieranie Danych',
      levels: [
        {
          level: 1,
          title: 'Manual Data Collection',
          description:
            'This involves employees manually completing forms with information about their work or other activities related to the organization. These forms typically include information about tasks performed, working hours, equipment used, materials and tools employed by the employee, and work-related problems or incidents.',
        },
        {
          level: 2,
          title: 'Graphic Symbols',
          description:
            'Such techniques as the use of barcodes or QR codes are popularly employed in warehouses, stores or production to identify goods, products or devices using a scanner. Each product or device is graphically labelled, and its data are stored in an IT system.',
        },
        {
          level: 3,
          title: 'Advanced Technological Solutions',
          description:
            'Technologies such as Radio Frequency Identification (RFID) streamline operations and processes. RFID enables the automatic identification and tracking of objects using radio waves. In manufacturing, this technology serves as a data collection system, significantly improving warehouse management, logistics and the monitoring of production processes.',
        },
        {
          level: 4,
          title: 'Data from Machines and Devices',
          description:
            'A key source of information is machines and devices equipped with various sensors that measure a range of process parameters, such as temperature, humidity, pressure, speed, rotations, vibrations and more. These data are collected in real-time and processed in IT systems, enabling continuous monitoring and analysis of production processes.',
        },
        {
          level: 5,
          title: 'Mobile Data Collection',
          description:
            "Crucial information can be gathered regarding employees' interactions with mobile applications and devices used to monitor their work. These data may include information about employees' location, behaviours and preferences, and other relevant factors.",
        },
        {
          level: 6,
          title: 'Data from Physical Objects',
          description:
            'Modern sensors are increasingly recording various environmental parameters such as temperature, humidity, pressure, light intensity or motion. The data that are collected are extremely valuable, as they can be used for various purposes such as monitoring working conditions, performing machine diagnostics and optimizing production processes.',
        },
        {
          level: 7,
          title: 'Optical Control',
          description:
            'This advanced approach to collecting data from physical objects uses cameras and other optical devices to monitor and assess the state of physical objects. Optical devices capture images of objects, which are then meticulously analysed for potential damages or other irregularities.',
        },
      ],
    },
    {
      id: '4B',
      name: 'Data Storage Methodology',
      namePL: 'Metodologia Przechowywania Danych',
      levels: [
        {
          level: 1,
          title: 'Traditional Methods',
          description:
            'These rely on physically recording information on paper. Data are printed and archived as hard copies in offices or specialized archives. This approach is typical for smaller firms lacking extensive IT systems and databases.',
        },
        {
          level: 2,
          title: 'Single Local Digital Storage',
          description:
            'Information is held on a single device or workstation, which limits data access to that device only, meaning the information is not available to other users or systems. This approach is often employed in machine control systems, where data generated by the machine are stored on a local control device.',
        },
        {
          level: 3,
          title: 'Dispersed Local Digital Storage',
          description:
            'Various computers or devices are commonly used for data storage in small businesses or by individual users. Data are saved on the hard drives of individual computers, resulting in a lack of centralization in data storage.',
        },
        {
          level: 4,
          title: 'Local Cloud Storage',
          description:
            'A company maintains and manages cloud infrastructure in its own data centre. This allows the organization to retain full control over its data and ensure a high level of security, as access to data is limited to authorized personnel.',
        },
        {
          level: 5,
          title: 'Public Cloud Storage',
          description:
            'This involves using the data-processing services of external cloud service providers. These providers maintain cloud infrastructure, which their clients access via the Internet. Public clouds offer a wide range of services, including data processing, data storage, virtual machines and tools for data analysis.',
        },
        {
          level: 6,
          title: 'Private Cloud Storage',
          description:
            'Cloud infrastructure is dedicated to a single organization. This means that cloud resources such as servers, storage and network are available only to the employees of that specific organization, and not to external users.',
        },
        {
          level: 7,
          title: 'Hybrid Approaches',
          description:
            'Companies strategically manage their data storage by utilizing a mix of solutions tailored to the specific needs of different types of data. For instance, operational data critical for production processes are stored on edge devices for immediate access, while sensitive information like technical drawings is kept in private clouds to enhance security.',
        },
      ],
    },
    {
      id: '4C',
      name: 'Data Communication',
      namePL: 'Komunikacja Danych',
      levels: [
        {
          level: 1,
          title: 'Hard-copy Reporting',
          description:
            'Traditional paper reports are the primary means of communication and data transmission. This classic method involves printing data out and passing them between employees or sending them outside the company.',
        },
        {
          level: 2,
          title: 'Email Reporting',
          description:
            'This is a fast and convenient method of information transfer, facilitating easy document sharing among employees and ensuring easy access. However, it comes with data security risks, such as the possibility of data interception by unauthorized individuals or email system failures.',
        },
        {
          level: 3,
          title: 'Ethernet-based Architecture',
          description:
            'This is one of the most popular ways of building computer networks, allowing data transmission between devices using an Ethernet cable. Ethernet-based architecture is applied in Local Area Networks (LANs), which are known for their high performance and operational reliability.',
        },
        {
          level: 4,
          title: 'Industrial Ethernet',
          description:
            'This specialized network configuration is designed for industrial applications and has higher reliability, security and data transmission speed than traditional Ethernet networks. Industrial networks employ special network devices such as switches, routers and gateways that are resistant to industrial conditions.',
        },
        {
          level: 5,
          title: 'Wireless Communication',
          description:
            'Devices in this network connect to one another via a central access point, facilitating centralized network management. Wireless networks find applications in various industries, including manufacturing, transportation, medicine and services.',
        },
        {
          level: 6,
          title: 'WAN/LAN Architecture',
          description:
            'Here, devices like routers, switches and servers connect multiple computers and devices into a network. WAN/LAN networks provide a stable connection between company branches and offices, enabling access to data and applications from different devices and locations.',
        },
        {
          level: 7,
          title: 'Cloud-based Architecture',
          description:
            'Applications, data and resources are stored and processed in the cloud, which is usually provided by an external vendor. A cloud-based architecture allows access to applications and data from anywhere and any Internet-enabled device, allowing resources to be scaled flexibly according to needs.',
        },
      ],
    },
    {
      id: '4D',
      name: 'Big Data Analysis',
      namePL: 'Analiza Big Data',
      levels: [
        {
          level: 1,
          title: 'DBMS',
          description:
            'DataBase Management Systems facilitate effective data management by allowing large datasets to be created, stored, updated and analysed, giving them a crucial role in data collection and organization. DBMSs have applications in various fields, from business to science and engineering.',
        },
        {
          level: 2,
          title: 'ETL Systems',
          description:
            'Extract, Transform, Load systems perform a key process in data management to enable the collection, processing and loading of information from various sources into a single database. ETL systems allow efficient data acquisition from diverse sources such as databases, CSV files, spreadsheets or XML files.',
        },
        {
          level: 3,
          title: 'Visualization Tools',
          description:
            'Data are far better comprehended when presented in an effective graphical form. These tools enable users, including managers and business analysts, to quickly create various visualizations like charts, tables and heatmaps that improve our understanding of the information stored in databases.',
        },
        {
          level: 4,
          title: 'Large Database Analysis Tools',
          description:
            'A crucial element in Big Data analysis, these are advanced applications and platforms, such as Apache, that enable the processing and analysis of massive amounts of data in a distributed manner. This means that data are processed on multiple servers simultaneously, ensuring scalability and significant computing performance.',
        },
        {
          level: 5,
          title: 'Data Quality Management',
          description:
            'Data quality can be checked, improved and maintained through the automated detection and elimination of data errors, standardization of data, verification of information from external sources, and completion of missing data.',
        },
        {
          level: 6,
          title: 'Data Simulation',
          description:
            'Data simulation is an incredibly useful tool in various fields and involves the creation of data that mimic real-world information. This is particularly valuable for testing different scenarios and variations of system operations, algorithms or mathematical models.',
        },
        {
          level: 7,
          title: 'Machine Learning Algorithms',
          description:
            'These powerful tools can identify and classify atypical data in ways that are often hard or impossible using traditional analytical methods. The algorithms learn from existing data in order to classify new data, making them extremely versatile.',
        },
      ],
    },
    {
      id: '4E',
      name: 'Computing',
      namePL: 'Przetwarzanie Danych',
      levels: [
        {
          level: 1,
          title: 'PC Computation',
          description:
            'Personal Computers are used for data-processing tasks. These stations are equipped with efficient data-processing software and hardware. Data processing on PC stations is suited to various applications.',
        },
        {
          level: 2,
          title: 'Server Computation',
          description:
            'Dedicated servers handle data processing tasks, providing more computing power and reliability than individual PCs. Servers can handle multiple concurrent processes and users.',
        },
        {
          level: 3,
          title: 'Cluster Computing',
          description:
            'Multiple servers work together as a cluster to process data. This approach provides higher availability and fault tolerance. Workloads are distributed across cluster nodes.',
        },
        {
          level: 4,
          title: 'Grid Computing',
          description:
            'Computing resources from multiple locations are combined to tackle complex computational tasks. Grid computing enables the sharing of resources across organizational boundaries.',
        },
        {
          level: 5,
          title: 'Cloud Computing',
          description:
            'Computing resources are provided as a service over the internet. Cloud computing offers scalability, flexibility, and pay-per-use pricing models. Resources can be provisioned on-demand.',
        },
        {
          level: 6,
          title: 'Edge Computing',
          description:
            'Data processing occurs close to the data source, reducing latency and bandwidth requirements. Edge computing is essential for real-time applications and IoT devices.',
        },
        {
          level: 7,
          title: 'Quantum Computing',
          description:
            'Quantum computers leverage quantum mechanics principles to perform computations. They can solve certain problems exponentially faster than classical computers, opening new possibilities for optimization and simulation.',
        },
      ],
    },
  ],
};

// ============================================
// AXIS 5: CULTURE OF TRANSFORMATION (5 areas, 6 levels)
// ============================================

const AXIS_5_CULTURE: DRDAxis = {
  id: 5,
  name: 'Culture of Transformation',
  namePL: 'Kultura Transformacji',
  description:
    'Assessment of whether culture and competencies enable transformation (not just buying technology). Per the DRD book, 5A describes leadership TYPES (not better/worse), while 5B–5E use a 1–6 maturity scale.',
  levelCount: 6,
  areas: [
    {
      id: '5A',
      name: 'Leadership Attitudes',
      namePL: 'Postawy przywódcze',
      levels: [
        {
          level: 1,
          title: 'Pasywny',
          description:
            'Typ przywództwa (nie „lepszy/gorszy") wg książki: lider pasywny, brak wsparcia dla innowacji i zmiany.',
        },
        {
          level: 2,
          title: 'Autokratyczny',
          description:
            'Typ przywództwa wg książki: decyzje podejmowane centralnie, niski udział zespołu w procesie decyzyjnym.',
        },
        {
          level: 3,
          title: 'Dyrektywny',
          description:
            'Typ przywództwa wg książki: wysokie wymagania połączone z zapewnieniem narzędzi i zasobów do ich realizacji.',
        },
        {
          level: 4,
          title: 'Wspierający',
          description:
            'Typ przywództwa wg książki: budowanie bezpieczeństwa psychologicznego i motywowanie zespołu.',
        },
        {
          level: 5,
          title: 'Innowator',
          description:
            'Typ przywództwa wg książki: podejmowanie ryzyka, eksperymentowanie i napędzanie zmiany.',
        },
        {
          level: 6,
          title: 'Transformacyjny',
          description:
            'Typ przywództwa wg książki: wizja, etyka, odrzucenie status quo i rozwój ludzi. To skala typów, nie rosnąca dojrzałość — oceniaj typ dominujący i 1–2 wspierające.',
        },
      ],
    },
    {
      id: '5B',
      name: 'Readiness for Change',
      namePL: 'Gotowość na zmianę',
      levels: [
        {
          level: 1,
          title: 'Rozpoznanie potrzeby',
          description: 'Organizacja rozpoznaje potrzebę zmiany.',
        },
        {
          level: 2,
          title: 'Koalicja zmiany',
          description: 'Budowana jest koalicja zmiany — zespół i sponsorzy.',
        },
        {
          level: 3,
          title: 'Poszukiwanie wizji',
          description: 'Trwa poszukiwanie wizji i strategii zmiany.',
        },
        {
          level: 4,
          title: 'Komunikowanie wizji',
          description: 'Wizja jest komunikowana w organizacji, dwukierunkowo.',
        },
        {
          level: 5,
          title: 'Wdrażanie zmiany',
          description: 'Zmiana jest wdrażana poprzez inicjatywy i kryteria postępu.',
        },
        {
          level: 6,
          title: 'Instytucjonalizacja',
          description:
            'Zmiana jest zinstytucjonalizowana — zakorzeniona w kulturze i sposobie pracy.',
        },
      ],
    },
    {
      id: '5C',
      name: 'Continuous Competency Development',
      namePL: 'Ciągły rozwój kompetencji',
      levels: [
        {
          level: 1,
          title: 'Kontakt zewnętrzny',
          description: 'Rozwój przez kontakt zewnętrzny — udział w targach i konferencjach.',
        },
        {
          level: 2,
          title: 'Szkolenia wewnętrzne',
          description: 'Prowadzone są szkolenia wewnętrzne.',
        },
        {
          level: 3,
          title: 'Szkolenia zewnętrzne',
          description: 'Organizacja korzysta ze szkoleń zewnętrznych.',
        },
        {
          level: 4,
          title: 'Self-learning',
          description: 'Wspierany jest self-learning — platformy, książki, kursy.',
        },
        {
          level: 5,
          title: 'Zespoły projektowe',
          description: 'Rozwój przez pracę w zespołach projektowych (learning-by-doing).',
        },
        {
          level: 6,
          title: 'Mentoring',
          description: 'Działa mentoring — systemowe rozwijanie juniorów.',
        },
      ],
    },
    {
      id: '5D',
      name: 'Innovation Culture',
      namePL: 'Kultura innowacji',
      levels: [
        {
          level: 1,
          title: 'Promowanie pomysłów',
          description: 'Promowanie pomysłów — hackathony, platformy idei.',
        },
        {
          level: 2,
          title: 'Eksperymentowanie',
          description: 'Eksperymentowanie — prototypy i pilotaże.',
        },
        {
          level: 3,
          title: 'Analiza trendów',
          description: 'Aktywna analiza trendów rynkowych.',
        },
        {
          level: 4,
          title: 'Akceptacja błędów',
          description: 'Akceptacja błędów jako element uczenia się.',
        },
        {
          level: 5,
          title: 'R&D w strategii',
          description: 'R&D wpisane w strategię firmy — ciągłe, nie „ad hoc".',
        },
        {
          level: 6,
          title: 'Współpraca zewnętrzna',
          description: 'Współpraca zewnętrzna w strategii — startupy, uczelnie, partnerzy.',
        },
      ],
    },
    {
      id: '5E',
      name: 'Resource Availability',
      namePL: 'Dostępność zasobów',
      levels: [
        {
          level: 1,
          title: 'Kapitał',
          description: 'Dostęp do kapitału — plan finansowania inicjatyw.',
        },
        {
          level: 2,
          title: 'Szkolenia',
          description: 'Dostęp do szkoleń — ścieżki rozwoju.',
        },
        {
          level: 3,
          title: 'Eksperci',
          description: 'Dostęp do ekspertów — wewnętrznych i zewnętrznych.',
        },
        {
          level: 4,
          title: 'Dane',
          description: 'Dostęp do danych — systemy, bezpieczeństwo, sposób użycia.',
        },
        {
          level: 5,
          title: 'Technologia',
          description: 'Dostęp do technologii — narzędzia wraz ze wsparciem.',
        },
        {
          level: 6,
          title: 'Partnerzy',
          description: 'Dostęp do partnerów — ekosystem i współpraca.',
        },
      ],
    },
  ],
};

// ============================================
// AXIS 6: CYBERSECURITY (5 areas, 6 levels)
// ============================================

const AXIS_6_CYBERSECURITY: DRDAxis = {
  id: 6,
  name: 'Cybersecurity',
  namePL: 'Cyberbezpieczeństwo',
  description:
    'Assessment of cybersecurity maturity as a condition for survival (not just an IT problem). Each area uses a cumulative 1–6 scale per the DRD book.',
  levelCount: 6,
  areas: [
    {
      id: '6A',
      name: 'Strategy and Risk Management',
      namePL: 'Strategia i zarządzanie ryzykiem',
      levels: [
        {
          level: 1,
          title: 'Brak strategii',
          description: 'Brak strategii i polityk bezpieczeństwa.',
        },
        {
          level: 2,
          title: 'Analiza ryzyka',
          description: 'Prowadzona jest analiza ryzyka.',
        },
        {
          level: 3,
          title: 'Plan działań',
          description: 'Powstaje plan działań w obszarze bezpieczeństwa.',
        },
        {
          level: 4,
          title: 'Polityki bezpieczeństwa',
          description: 'Wdrożone polityki bezpieczeństwa — standardy i procedury.',
        },
        {
          level: 5,
          title: 'HR w strategii',
          description: 'HR włączone w strategię — szkolenia i budowanie kompetencji.',
        },
        {
          level: 6,
          title: 'Monitoring i ocena',
          description: 'Monitoring i ocena skuteczności — audyty, testy, analiza logów.',
        },
      ],
    },
    {
      id: '6B',
      name: 'Network and System Protection',
      namePL: 'Ochrona sieci i systemów',
      levels: [
        {
          level: 1,
          title: 'Firewalle',
          description: 'Stosowane są firewalle.',
        },
        {
          level: 2,
          title: 'Antywirus',
          description: 'Wdrożona ochrona antywirusowa.',
        },
        {
          level: 3,
          title: 'IDS',
          description: 'Działają systemy wykrywania włamań (IDS).',
        },
        {
          level: 4,
          title: 'SIEM/IDS korelujące',
          description: 'SIEM/IDS korelujące zdarzenia z wielu źródeł.',
        },
        {
          level: 5,
          title: 'Autoryzacja i uwierzytelnianie',
          description: 'Wdrożone mechanizmy autoryzacji i uwierzytelniania.',
        },
        {
          level: 6,
          title: 'VPN i segmentacja',
          description: 'VPN — bezpieczne kanały i segmentacja połączeń.',
        },
      ],
    },
    {
      id: '6C',
      name: 'Data Security',
      namePL: 'Ochrona danych',
      levels: [
        {
          level: 1,
          title: 'Szyfrowanie',
          description: 'Stosowane jest szyfrowanie danych.',
        },
        {
          level: 2,
          title: 'Polityka haseł',
          description: 'Polityka haseł i bezpieczne przechowywanie.',
        },
        {
          level: 3,
          title: 'Kontrola dostępu',
          description: 'Kontrola dostępu — role i audyt.',
        },
        {
          level: 4,
          title: 'Backup i DR',
          description: 'Backup oraz disaster recovery.',
        },
        {
          level: 5,
          title: 'Monitoring i detekcja',
          description: 'Monitoring i detekcja zagrożeń.',
        },
        {
          level: 6,
          title: 'Weryfikacja tożsamości',
          description: 'Weryfikacja tożsamości (np. certyfikaty/biometria) wraz z procesami.',
        },
      ],
    },
    {
      id: '6D',
      name: 'Security Education and System Quality',
      namePL: 'Edukacja i jakość systemów',
      levels: [
        {
          level: 1,
          title: 'Opis systemu szkoleń',
          description: 'Istnieje opis systemu szkoleń z bezpieczeństwa.',
        },
        {
          level: 2,
          title: 'Plan wdrożenia szkoleń',
          description: 'Plan wdrożenia szkoleń w różnych formach.',
        },
        {
          level: 3,
          title: 'System testów',
          description: 'Działa system testów bezpieczeństwa.',
        },
        {
          level: 4,
          title: 'Audytorzy wewnętrzni',
          description: 'Wyznaczeni audytorzy wewnętrzni.',
        },
        {
          level: 5,
          title: 'Plan audytów cyber',
          description: 'Istnieje plan audytów cyberbezpieczeństwa.',
        },
        {
          level: 6,
          title: 'ISO 27001',
          description:
            'Certyfikacja ISO 27001 (system zarządzania bezpieczeństwem informacji, ISMS).',
        },
      ],
    },
    {
      id: '6E',
      name: 'Contingency Plans',
      namePL: 'Plany awaryjne',
      levels: [
        {
          level: 1,
          title: 'Identyfikacja zagrożeń',
          description: 'Identyfikacja zagrożeń.',
        },
        {
          level: 2,
          title: 'Priorytety w incydencie',
          description: 'Ustalone priorytety postępowania w incydencie.',
        },
        {
          level: 3,
          title: 'Procedury postępowania',
          description: 'Opracowane procedury postępowania.',
        },
        {
          level: 4,
          title: 'Szkolenia awaryjne',
          description: 'Regularne szkolenia awaryjne.',
        },
        {
          level: 5,
          title: 'Testy planów',
          description: 'Testy planów awaryjnych w oparciu o scenariusze.',
        },
        {
          level: 6,
          title: 'Dokumentacja i doskonalenie',
          description: 'Dokumentacja i ciągłe doskonalenie planów.',
        },
      ],
    },
  ],
};

// ============================================
// AXIS 7: AI MATURITY (5 areas, 5 levels)
// ============================================

const AXIS_7_AI_MATURITY: DRDAxis = {
  id: 7,
  name: 'AI Maturity',
  namePL: 'Dojrzałość AI',
  description: 'Assessment of AI readiness, adoption and governance',
  levelCount: 5,
  areas: [
    {
      id: '7A',
      name: 'Data and AI Foundations',
      namePL: 'Dane i Fundamenty AI',
      levels: [
        {
          level: 1,
          title: 'Fragmented Data, No AI Readiness',
          description:
            'Data is scattered across spreadsheets, local drives, and disconnected systems. There is no single source of truth. Every analysis requires manual data collection. Data is incomplete or inconsistent between systems. AI cannot work because data is not available in the right format.',
        },
        {
          level: 2,
          title: 'Structured Data in Silos',
          description:
            'The company has multiple digital systems (ERP, MES, CRM), but each stores data in its own silo. Data is more structured, but not easily accessible for AI. Exports are done manually. Data is digital, but not connected.',
        },
        {
          level: 3,
          title: 'Centralized Data & Initial AI Readiness',
          description:
            'The organization builds its first centralized data repositories. ETL processes start operating and data is brought into one place. First machine learning projects appear, based on standardized datasets. Data in the warehouse is updated regularly.',
        },
        {
          level: 4,
          title: 'Fully AI-Ready Data Architecture',
          description:
            'The organization has consistent governance principles, data quality is monitored, and data sources are documented. Data is available near real-time. Data is consistently accessible, coherent, and up to date. AI models have stable, repeatable pipelines.',
        },
        {
          level: 5,
          title: 'Autonomous Data Intelligence',
          description:
            'Data is automatically prepared, cleaned, versioned, and made available to AI models. Systems can detect anomalies, fill gaps, and optimize data flows without human involvement. Data is treated as a product ("data as a product").',
        },
      ],
    },
    {
      id: '7B',
      name: 'AI-Supported Processes',
      namePL: 'Procesy Wspierane przez AI',
      levels: [
        {
          level: 1,
          title: 'Isolated AI Experiments',
          description:
            'AI appears in the organization only as small, disconnected initiatives. These may include experiments with generative tools, chatbots, OCR, or basic office automation — but they do not affect core business processes. AI runs "next to" processes, not inside them.',
        },
        {
          level: 2,
          title: 'Assisted Work Automation',
          description:
            'AI supports employees in performing tasks, but it does not make decisions within processes. First automations appear: scheduling meetings, generating content, document analysis. The role of AI is to accelerate human work, not replace it. AI improves efficiency, but does not yet influence process quality.',
        },
        {
          level: 3,
          title: 'Integrated AI Decision Support',
          description:
            'AI becomes part of the process, not an add-on. AI models provide operational recommendations (forecasts, scoring). Employees make decisions based on AI suggestions. Processes are designed to incorporate data and algorithms — but accountability remains with humans.',
        },
        {
          level: 4,
          title: 'Semi-Autonomous Processes',
          description:
            'AI performs part of the process activities autonomously. A human acts as a supervisor or approver. Examples: automated planning, dynamic inventory control. In many processes, humans no longer decide — they mainly oversee the system.',
        },
        {
          level: 5,
          title: 'Fully Autonomous Operational Orchestration',
          description:
            'Processes are designed to be executed by autonomous AI systems. AI not only decides, but also monitors, reacts, and optimizes how the organization operates. Humans focus on oversight, audits, and strategy. Processes run end-to-end without human involvement.',
        },
      ],
    },
    {
      id: '7C',
      name: 'AI in Products and Services',
      namePL: 'AI w Produktach i Usługach',
      levels: [
        {
          level: 1,
          title: 'No AI Components in Products',
          description:
            'Products and services contain no AI components. Customer value comes entirely from traditional features. Products behave the same for every user. There are no predictive or recommendation capabilities.',
        },
        {
          level: 2,
          title: 'Add-On AI Features',
          description:
            'AI appears as an add-on module that enhances the product, but does not define it. AI features are improvements (recommendations, simple summaries). AI enhances the customer experience, while the product retains a classic structure.',
        },
        {
          level: 3,
          title: 'AI as a Core Product Component',
          description:
            'AI becomes a key part of the product architecture. Without it, most modern features would not work. The product "understands" the user, adapts, and reacts to data. The product meaningfully differentiates from competitors thanks to AI.',
        },
        {
          level: 4,
          title: 'Fully AI-Driven Products',
          description:
            'AI drives most of the product logic and dynamically adapts behavior. The product continuously learns customer behavior, optimizes processes, and reacts in real time. Functionality is personalized, adaptive, and self-improving.',
        },
        {
          level: 5,
          title: 'AI-Native Business Offerings',
          description:
            'The company offers products or services that could not exist without AI. AI defines the entire business model. Autonomous management systems, agents, and digital twins emerge. The product behaves like an intelligent system, not just an application.',
        },
      ],
    },
    {
      id: '7D',
      name: 'Governance, Security and Ethics',
      namePL: 'Governance, Bezpieczeństwo i Etyka',
      levels: [
        {
          level: 1,
          title: 'No AI Governance, Uncontrolled Use',
          description:
            'AI is used spontaneously and without oversight. Employees use AI tools at their own discretion. There are no usage policies, security rules, or privacy standards. The organization is unaware of key risks.',
        },
        {
          level: 2,
          title: 'Basic AI Usage Policies',
          description:
            'The organization begins to recognize risks and creates basic rules for using AI (what is allowed and what is not). These policies are informational and not yet fully enforced. Decisions remain with departments or individuals.',
        },
        {
          level: 3,
          title: 'Organization-Wide AI Governance Framework',
          description:
            'The company formalizes its AI approach. Project approval processes, risk assessment criteria, and dedicated roles (AI Officer/Committee) are introduced. Models are versioned and audited. AI is not deployed without formal approval.',
        },
        {
          level: 4,
          title: 'Continuous AI Risk Management & Monitoring',
          description:
            'The organization has a structured, continuous AI control system. This includes real-time model monitoring, drift detection, and security testing. AI is treated as seriously as mission-critical systems.',
        },
        {
          level: 5,
          title: 'Ethical, Transparent & Autonomous AI Governance',
          description:
            'AI governance is automated, built into systems, and aligned with best ethical practices. AI systems detect issues and respond. The company has an advanced approach to transparency and can demonstrate it to auditors.',
        },
      ],
    },
    {
      id: '7E',
      name: 'AI Competencies and Culture',
      namePL: 'Kompetencje i Kultura AI',
      levels: [
        {
          level: 1,
          title: 'No Competencies',
          description:
            'Employees have no AI skills and rely on manual methods. Skepticism or fear dominates.',
        },
        {
          level: 2,
          title: 'Ad-hoc Usage',
          description:
            'Some people use basic tools on their own. There is no training; knowledge is tribal and informal.',
        },
        {
          level: 3,
          title: 'Organized Development',
          description:
            'The company provides training and tools. Roles are defined (e.g. AI Champion). First team successes appear.',
        },
        {
          level: 4,
          title: 'AI Fluency',
          description:
            'Employees build simple automations and AI workflows themselves. Continuous upskilling is the norm.',
        },
        {
          level: 5,
          title: 'AI-Native Workforce',
          description:
            'Human–AI collaboration is seamless. Employees manage AI agents that execute operational tasks.',
        },
      ],
    },
  ],
};

// ============================================
// COMPLETE DRD STRUCTURE
// ============================================

export const DRD_STRUCTURE: DRDAxis[] = [
  AXIS_1_PROCESSES,
  AXIS_2_PRODUCTS,
  AXIS_3_BUSINESS_MODELS,
  AXIS_4_DATA_MANAGEMENT,
  AXIS_5_CULTURE,
  AXIS_6_CYBERSECURITY,
  AXIS_7_AI_MATURITY,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all areas for a specific axis
 */
export const getQuestionsForAxis = (axisId: number): DRDArea[] => {
  return DRD_STRUCTURE.find((a) => a.id === axisId)?.areas || [];
};

/**
 * Get a specific axis by ID
 */
export const getAxisById = (axisId: number): DRDAxis | undefined => {
  return DRD_STRUCTURE.find((a) => a.id === axisId);
};

/**
 * Get a specific area by ID (e.g., "1A", "2B")
 */
export const getAreaById = (areaId: string): DRDArea | undefined => {
  for (const axis of DRD_STRUCTURE) {
    const area = axis.areas.find((a) => a.id === areaId);
    if (area) return area;
  }
  return undefined;
};

/**
 * Get the axis that contains a specific area
 */
export const getAxisForArea = (areaId: string): DRDAxis | undefined => {
  return DRD_STRUCTURE.find((axis) => axis.areas.some((a) => a.id === areaId));
};

/**
 * Get total number of assessment areas
 */
export const getTotalAreaCount = (): number => {
  return DRD_STRUCTURE.reduce((sum, axis) => sum + axis.areas.length, 0);
};

/**
 * Calculate overall DRD score from area scores
 */
export const calculateOverallScore = (
  areaScores: Record<string, { actual: number; target: number }>
): { actual: number; target: number; gap: number } => {
  const scores = Object.values(areaScores);
  if (scores.length === 0) return { actual: 0, target: 0, gap: 0 };

  const totalActual = scores.reduce((sum, s) => sum + s.actual, 0);
  const totalTarget = scores.reduce((sum, s) => sum + s.target, 0);
  const count = scores.length;

  const actual = Math.round((totalActual / count) * 10) / 10;
  const target = Math.round((totalTarget / count) * 10) / 10;
  const gap = Math.round((target - actual) * 10) / 10;

  return { actual, target, gap };
};

/**
 * Calculate axis score from its area scores
 */
export const calculateAxisScore = (
  axisId: number,
  areaScores: Record<string, { actual: number; target: number }>
): { actual: number; target: number; gap: number } => {
  const axis = getAxisById(axisId);
  if (!axis) return { actual: 0, target: 0, gap: 0 };

  const relevantScores = axis.areas
    .map((area) => areaScores[area.id])
    .filter((s) => s !== undefined);

  if (relevantScores.length === 0) return { actual: 0, target: 0, gap: 0 };

  const totalActual = relevantScores.reduce((sum, s) => sum + s.actual, 0);
  const totalTarget = relevantScores.reduce((sum, s) => sum + s.target, 0);
  const count = relevantScores.length;

  const actual = Math.round((totalActual / count) * 10) / 10;
  const target = Math.round((totalTarget / count) * 10) / 10;
  const gap = Math.round((target - actual) * 10) / 10;

  return { actual, target, gap };
};

// ============================================
// COORD-11 — versioned scoring (§6.1/§6.2 of docs/product/DRD_CANON.md)
// ============================================
//
// `calculateOverallScore` / `calculateAxisScore` above are frozen exactly as
// they were before COORD-11 — DO NOT edit them. They have two confirmed
// defects vs. canon §6:
//
//   DEFECT 1 (no normalization): a level-5 area on a 1-5 axis (=100% of that
//   axis's ladder) and a level-5 area on a 1-7 axis (=66.7% of that ladder)
//   both report `actual: 5` — see zz-opus-drd-agg-probe.test.ts.
//
//   DEFECT 2 (zero counted as a level): the only filter is `s !== undefined`,
//   so an unassessed area recorded as `{actual: 0}` is averaged in as if "0"
//   were a real, low maturity level. Canon §6.2: "Obszary nieocenione
//   (score_raw = 0) nie wchodzą do średniej ... Zakaz liczenia zera jako
//   poziomu."
//
// `legacy_v1` below is that exact behavior, explicitly named and re-exported
// so callers can pin it on purpose. `drd_scoring_v2` is the canon-correct
// engine. Nothing switches to v2 automatically — see
// `src/utils/drdScoringV2Flag.ts` (default OFF) and
// `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/DRD_SCORING_V1_VS_V2.md`.

/** Traceability tag: which formula produced a given score. */
export type DrdCalculationVersion = 'legacy_v1' | 'drd_scoring_v2';

/**
 * DRD maturity level bands per canon §6.2:
 *   [0-0.2) I · [0.2-0.4) II · [0.4-0.6) III · [0.6-0.8) IV · [0.8-1.0] V
 */
export type DrdMaturityLevel = 'I' | 'II' | 'III' | 'IV' | 'V';

export function drdLevelFromNorm(norm: number): DrdMaturityLevel {
  if (norm < 0.2) return 'I';
  if (norm < 0.4) return 'II';
  if (norm < 0.6) return 'III';
  if (norm < 0.8) return 'IV';
  return 'V';
}

/**
 * Four-plus-one area states the legacy engine conflates into a single
 * `{actual: number}`. Canon §6.2 only explicitly names the first pair
 * ("nieocenione" / assessed) — the other three are this engine's explicit,
 * documented rules for cases the canon is silent on (see
 * DRD_SCORING_V1_VS_V2.md "Canon citations" table); never silent imputation.
 *
 *  - 'assessed'              achieved_level ∈ [1, Lmax(a)] — a real measured
 *                            value. The only state that contributes a
 *                            non-null `scoreNorm`.
 *  - 'assessed_zero'         achieved_level === 0, EXPLICITLY recorded as a
 *                            real (not missing) zero. DRD's ladders are
 *                            defined 1..Lmax (see DRD_STRUCTURE — every axis
 *                            starts numbering areas' levels at 1), so a real
 *                            achieved_level of 0 is NOT a valid position on
 *                            any DRD ladder. This state exists in the type
 *                            for API completeness (other method packs may
 *                            allow a real zero); for DRD specifically it is
 *                            normalized identically to 'unassessed' (excluded,
 *                            never imputed as the lowest level) — see the
 *                            EVIDENCE_MISSING note in DRD_SCORING_V1_VS_V2.md.
 *  - 'unassessed'            not measured (null/undefined, or the legacy `0`
 *                            sentinel when no explicit `state` is given).
 *                            NEVER treated as the lowest level. Lowers
 *                            `coverage`, excluded from the mean.
 *  - 'insufficient_evidence' an answer/level was proposed but evidence does
 *                            not support it (mirrors `needs_evidence` in
 *                            `method-core/methods/drd/drdAdapter.ts`).
 *                            NEVER promotes the level — excluded from the
 *                            mean, same treatment as 'unassessed'.
 *  - 'not_applicable'        out of scope for this organization. Canon §6
 *                            does not state whether N/A areas lower the
 *                            denominator — EVIDENCE_MISSING against a canon
 *                            citation. Named rule adopted here (see
 *                            DRD_SCORING_V1_VS_V2.md): N/A is removed from
 *                            BOTH numerator and denominator, i.e. it does
 *                            NOT lower `coverage`/`completeness` the way
 *                            'unassessed' does.
 */
export type DrdAreaState =
  | 'assessed'
  | 'assessed_zero'
  | 'unassessed'
  | 'insufficient_evidence'
  | 'not_applicable';

/** Per-area input for the v2 engine. `state` is optional — when omitted it is
 * inferred from `actual` (`null`/`undefined`/`0` → 'unassessed'), matching
 * the shape most legacy callers already produce (`{actual, target}`). */
export interface DrdAreaInputV2 {
  readonly actual: number | null | undefined;
  readonly target?: number | null;
  readonly state?: DrdAreaState;
}

/** Per-area normalized result (score_norm/target_norm/gap per canon §6.1). */
export interface DrdAreaNormResult {
  readonly areaId: string;
  readonly axisId: number;
  readonly lmax: number;
  readonly state: DrdAreaState;
  readonly scoreNorm: number | null;
  readonly targetNorm: number | null;
  readonly gapNorm: number | null;
}

/** Aggregate result for `drd_scoring_v2` — always reports coverage/exclusions
 * explicitly instead of hiding them behind a single averaged number. */
export interface DrdAggregateResultV2 {
  readonly calculationVersion: 'drd_scoring_v2';
  /** Mean of `scoreNorm` over 'assessed' areas only. `null` when nothing is assessed. */
  readonly scoreNorm: number | null;
  readonly targetNorm: number | null;
  readonly gapNorm: number | null;
  readonly level: DrdMaturityLevel | null;
  readonly assessedCount: number;
  readonly assessedZeroCount: number;
  readonly unassessedCount: number;
  readonly insufficientEvidenceCount: number;
  readonly notApplicableCount: number;
  /** Areas counted in the coverage denominator (total minus not_applicable). */
  readonly denominatorCount: number;
  /** assessedCount / denominatorCount, in [0,1]. 0 when denominatorCount is 0. */
  readonly coverage: number;
  /** coverage * 100, rounded to 1 decimal place (e.g. 66.7). */
  readonly coveragePercent: number;
  /** Every area excluded from the mean, with its reason — "explicitly listed",
   * per canon §6.2, never just silently dropped. */
  readonly excluded: ReadonlyArray<{ readonly areaId: string; readonly state: DrdAreaState }>;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function inferDrdAreaState(actual: number | null | undefined): DrdAreaState {
  if (actual === null || actual === undefined) return 'unassessed';
  if (actual === 0) return 'unassessed'; // legacy sentinel — see DrdAreaState doc above
  return 'assessed';
}

/**
 * Normalizes one area's input into score_norm/target_norm/gap per canon §6.1:
 *   score_norm(a)  = (achieved_level(a) − 1) / (Lmax(a) − 1)
 *   target_norm(a) = (target_level(a) − 1) / (Lmax(a) − 1)
 *   gap(a)         = max(0, target_norm(a) − score_norm(a))
 * Returns `null` (not a thrown error) when `areaId` is not a known DRD area —
 * callers filter these out and the caller-facing functions below never crash
 * on an unknown id, they simply cannot score it.
 */
export function normalizeDrdAreaV2(areaId: string, input: DrdAreaInputV2): DrdAreaNormResult | null {
  const axis = getAxisForArea(areaId);
  if (!axis) return null;
  const lmax = axis.levelCount;
  const state: DrdAreaState = input.state ?? inferDrdAreaState(input.actual);

  if (state !== 'assessed') {
    return { areaId, axisId: axis.id, lmax, state, scoreNorm: null, targetNorm: null, gapNorm: null };
  }

  const achieved = input.actual as number;
  const scoreNorm = lmax > 1 ? clamp01(round((achieved - 1) / (lmax - 1), 6)) : 0;

  const target = input.target;
  const targetNorm =
    target === null || target === undefined
      ? null
      : lmax > 1
        ? clamp01(round((target - 1) / (lmax - 1), 6))
        : 0;
  const gapNorm = targetNorm === null ? null : round(Math.max(0, targetNorm - scoreNorm), 6);

  return { areaId, axisId: axis.id, lmax, state, scoreNorm, targetNorm, gapNorm };
}

function aggregateDrdAreasV2(
  entries: ReadonlyArray<readonly [string, DrdAreaInputV2]>
): DrdAggregateResultV2 {
  const normalized = entries
    .map(([id, v]) => normalizeDrdAreaV2(id, v))
    .filter((r): r is DrdAreaNormResult => r !== null);

  const assessed = normalized.filter((r) => r.state === 'assessed');
  const assessedZero = normalized.filter((r) => r.state === 'assessed_zero');
  const unassessed = normalized.filter((r) => r.state === 'unassessed');
  const insufficientEvidence = normalized.filter((r) => r.state === 'insufficient_evidence');
  const notApplicable = normalized.filter((r) => r.state === 'not_applicable');

  // Named rule (canon silent — see DrdAreaState doc / DRD_SCORING_V1_VS_V2.md):
  // not_applicable is removed from BOTH numerator and denominator.
  const denominator = normalized.filter((r) => r.state !== 'not_applicable');

  const scoreNorm =
    assessed.length > 0
      ? round(assessed.reduce((sum, r) => sum + (r.scoreNorm as number), 0) / assessed.length, 4)
      : null;

  const withTarget = assessed.filter((r) => r.targetNorm !== null);
  const targetNorm =
    withTarget.length > 0
      ? round(withTarget.reduce((sum, r) => sum + (r.targetNorm as number), 0) / withTarget.length, 4)
      : null;

  const gapNorm = scoreNorm !== null && targetNorm !== null ? round(Math.max(0, targetNorm - scoreNorm), 4) : null;

  const coverage = denominator.length > 0 ? assessed.length / denominator.length : 0;

  return {
    calculationVersion: 'drd_scoring_v2',
    scoreNorm,
    targetNorm,
    gapNorm,
    level: scoreNorm !== null ? drdLevelFromNorm(scoreNorm) : null,
    assessedCount: assessed.length,
    assessedZeroCount: assessedZero.length,
    unassessedCount: unassessed.length,
    insufficientEvidenceCount: insufficientEvidence.length,
    notApplicableCount: notApplicable.length,
    denominatorCount: denominator.length,
    coverage: round(coverage, 4),
    coveragePercent: round(coverage * 100, 1),
    excluded: normalized.filter((r) => r.state !== 'assessed').map((r) => ({ areaId: r.areaId, state: r.state })),
  };
}

/**
 * Overall DRD score across ALL areas — `drd_scoring_v2` engine.
 * Normalizes per §6.1 and excludes non-'assessed' areas from the mean per
 * §6.2 (explicitly listed in `.excluded`, never silently dropped).
 */
export function calculateOverallScoreV2(
  areaScores: Readonly<Record<string, DrdAreaInputV2>>
): DrdAggregateResultV2 {
  return aggregateDrdAreasV2(Object.entries(areaScores));
}

/**
 * Axis score — `drd_scoring_v2` engine. Only areas belonging to `axisId` are
 * considered (unknown/other-axis area ids in `areaScores` are ignored, same
 * scoping as legacy `calculateAxisScore`).
 */
export function calculateAxisScoreV2(
  axisId: number,
  areaScores: Readonly<Record<string, DrdAreaInputV2>>
): DrdAggregateResultV2 {
  const axis = getAxisById(axisId);
  if (!axis) return aggregateDrdAreasV2([]);
  const entries: Array<readonly [string, DrdAreaInputV2]> = axis.areas
    .filter((a) => areaScores[a.id] !== undefined)
    .map((a) => [a.id, areaScores[a.id]] as const);
  return aggregateDrdAreasV2(entries);
}

/** Explicit alias for `calculateOverallScore` — use this name when you want
 * the caller/reader to see, unambiguously, that the frozen legacy formula
 * (bit-for-bit, defects included) is being invoked on purpose. */
export const calculateOverallScoreLegacyV1 = calculateOverallScore;

/** Explicit alias for `calculateAxisScore` — see `calculateOverallScoreLegacyV1`. */
export const calculateAxisScoreLegacyV1 = calculateAxisScore;

export type DrdVersionedOverallResult =
  | ({ calculationVersion: 'legacy_v1' } & ReturnType<typeof calculateOverallScore>)
  | DrdAggregateResultV2;

/**
 * Version-dispatching entry point. Defaults to `legacy_v1` — callers that
 * want `drd_scoring_v2` must say so explicitly, either by passing `version`
 * directly or by reading `isDrdScoringV2Enabled()`
 * (`src/utils/drdScoringV2Flag.ts`) themselves and forwarding the result.
 * This function does NOT read the flag itself, mirroring
 * `rankByImpactValue`/`rankByImpactValueV2` in `siriPrioritisation.ts`
 * (COORD-08): the pure calculation layer stays free of `window`/env access;
 * flag resolution happens at the call site (e.g. `drdReportModel.ts`).
 */
export function calculateOverallScoreVersioned(
  areaScores: Record<string, { actual: number; target: number }>,
  version: DrdCalculationVersion = 'legacy_v1'
): DrdVersionedOverallResult {
  if (version === 'drd_scoring_v2') {
    return calculateOverallScoreV2(areaScores);
  }
  return { calculationVersion: 'legacy_v1', ...calculateOverallScore(areaScores) };
}

/** Version-dispatching entry point for axis scores. See `calculateOverallScoreVersioned`. */
export function calculateAxisScoreVersioned(
  axisId: number,
  areaScores: Record<string, { actual: number; target: number }>,
  version: DrdCalculationVersion = 'legacy_v1'
): DrdVersionedOverallResult {
  if (version === 'drd_scoring_v2') {
    return calculateAxisScoreV2(axisId, areaScores);
  }
  return { calculationVersion: 'legacy_v1', ...calculateAxisScore(axisId, areaScores) };
}

/**
 * Map DRD axis ID to internal key used in assessment data
 */
export const DRD_AXIS_KEY_MAP: Record<number, string> = {
  1: 'processes',
  2: 'digitalProducts',
  3: 'businessModels',
  4: 'dataManagement',
  5: 'culture',
  6: 'cybersecurity',
  7: 'aiMaturity',
};

/**
 * Reverse map: internal key to axis ID
 */
export const DRD_KEY_TO_AXIS_MAP: Record<string, number> = {
  processes: 1,
  digitalProducts: 2,
  businessModels: 3,
  dataManagement: 4,
  culture: 5,
  cybersecurity: 6,
  aiMaturity: 7,
};

export default DRD_STRUCTURE;
