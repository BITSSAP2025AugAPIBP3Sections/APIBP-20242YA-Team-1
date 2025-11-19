# Google Sheets Analytics Service

## Description
This service enables:
- Retrieving data from Google Sheets.
- Updating sheet data using a JSON file upload.
- Exporting data from Google Sheets into CSV or JSON formats.
- Well-structured REST APIs with Swagger documentation.
- Analytics of the data present in spreadsheet.
- Organized folder structure for handling master JSON uploads and exported files.
- Supports auto-reloading using **Nodemon** in development.

---

## Features

| Feature | Description |
|---------|-------------|
| Upload JSON | Reyrive a master JSON file of vendors to update the spreadsheet. |
| Export Data | Export Google Sheet data into CSV or JSON format. |
| Swagger Docs | Interactive API documentation available at `/api-docs`. |
| Folder Structure | Saves exports in `/exports`. |
| Google Sheets API | Uses `googleapis` to communicate with Google Sheets. |
| Analytics of data | Provides analytics on spreadsheet |


---

## 🛠 Tech Stack

| Layer           | Technology                  |
|-----------------|-----------------------------|
| Runtime         | Node.js                     |
| Framework       | Express.js                  |
| Language        | JavaScript                  |
| File Uploads    | Multer                      |
| HTTP Requests   | Axios                       |
| Env Management  | Dotenv                      |
| Documentation   | Swagger (swagger-jsdoc, swagger-ui-express) |
| Google Sheets   | Googleapis                  |
| Dev Tool        | Nodemon                

---

## Project Structure

google-sheets-analytics-service/
│
├── src/
│ ├── routes/ # API route definitions
│ ├── controllers/ # Upload and processing logic
│ ├── services/ # Google Sheets or business logic
│ └── utils/ # Helpers (file handling, logger, etc.)
│
├── uploads/
│ └── vendor/ # Stores uploaded master_sheet1.json files
│
├── config/ # Google API credentials & config files
├── .env
├── swagger.js # Swagger setup
├── package.json
└── README.md

## API Endpoints
POST
- /api/v1/sheets/update
- Request Body
[
  {
    "vendor_name": "Bioplex",
    "invoice_number": "BPXINV-00550",
    "invoice_date": "23.05.2021",
    "total_amount": "6610.95",
    "line_items": [
      {
        "item_description": "Dextromethorphan polistirex \nBPXPN-00057",
        "quantity": "10",
        "unit_price": "12.45",
        "amount": "124.50"
      },
      {
        "item_description": "Venlafaxine Hydrochloride \nBPXPN-00012",
        "quantity": "25",
        "unit_price": "16.00",
        "amount": "400.00"
      },
      {
        "item_description": "Metoclopramide Hydrochloride (BPXPO-00537)\nBPXPN-00002",
        "quantity": "25",
        "unit_price": "9.99",
        "amount": "249.75"
      }
    ]
  },
  {
    "vendor_name": "Bioplex",
    "invoice_number": "1213",
    "invoice_date": "16.12.2021",
    "total_amount": "2809.30",
    "line_items": [
      {
        "item_description": "Glossostigma",
        "quantity": "3",
        "unit_price": "9.90",
        "amount": "29.70"
      },
      {
        "item_description": "Bayberry",
        "quantity": "222",
        "unit_price": "5.44",
        "amount": "1,207.68"
      },
      {
        "item_description": "Waxflower",
        "quantity": "34",
        "unit_price": "1.67",
        "amount": "56.78"
      }
    ]
  }
]

GET
- /api/v1/sheets/analytics

GET
- /api/v1/sheets/export
## Getting Started

### 1. **Install Dependencies**
```bash
- npm install

- Once all dependencies are installed and the `.env` file is properly configured, start the server using:
```bash
   - npm start
   - swagger spec will be visible at http://localhost:4004/api-docs


