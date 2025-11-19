/**
 * Known vendor patterns for major e-commerce and service providers
 * Maps email domains/patterns to standardized vendor names
 */
const KNOWN_VENDORS = {
  // Amazon
  "amazon.com": "Amazon",
  "amazon.in": "Amazon",
  "payments.amazon.com": "Amazon",
  "payments.amazon.in": "Amazon",
  "ship-confirm": "Amazon",
  "auto-confirm": "Amazon",
  
  // Flipkart
  "flipkart.com": "Flipkart",
  "fkart.com": "Flipkart",
  "myntra.com": "Flipkart",  // Flipkart owns Myntra
  
  // Zomato
  "zomato.com": "Zomato",
  "blinkit.com": "Zomato",  // Zomato acquired Blinkit
  "grofers.com": "Zomato",  // Former name of Blinkit
  
  // Add more vendors as needed
  "swiggy.com": "Swiggy",
  "uber.com": "Uber",
  "ubereats.com": "Uber",
  "ola.com": "Ola",
  "makemytrip.com": "MakeMyTrip",
  "goibibo.com": "Goibibo",
};

/**
 * Detects vendor from email address and optional subject line
 * 
 * @param {string} fromEmail - The From header (e.g., "Amazon.in <ship-confirm@amazon.in>")
 * @param {string} subject - Optional email subject for additional context
 * @returns {string} Standardized vendor name
 * 
 * @example
 * detectVendor("ship-confirm@amazon.in") // Returns "Amazon"
 * detectVendor("noreply@flipkart.com") // Returns "Flipkart"
 * detectVendor("orders@zomato.com", "Your Zomato Order") // Returns "Zomato"
 */
export const detectVendor = (fromEmail = "", subject = "") => {
const safeFromEmail = String(fromEmail);
const emailMatch = safeFromEmail.match(/<(.+?)>/) || [null, safeFromEmail];
  
  // Validate email format
  if (!emailMatch[1] || !emailMatch[1].includes("@")) {
    return "Unknown";
  }

  const [username, domain] = emailMatch[1].split("@");

  // Check against known vendor domains first (highest priority)
  for (const [pattern, vendorName] of Object.entries(KNOWN_VENDORS)) {
    if (domain.includes(pattern) || username.includes(pattern)) {
      return vendorName;
    }
  }

  // Check subject line for vendor keywords
  if (subject) {
    const subjectLower = subject.toLowerCase();
    for (const [pattern, vendorName] of Object.entries(KNOWN_VENDORS)) {
      if (subjectLower.includes(pattern.split(".")[0])) {
        return vendorName;
      }
    }
  }

  // If personal email like gmail/yahoo → use username
  const personalDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com"];
  if (personalDomains.includes(domain)) {
    const vendor = username.replace(/[^a-z0-9]/g, "_");
    return vendor.charAt(0).toUpperCase() + vendor.slice(1);
  }

  // For business email use domain name
  const vendorFromDomain = domain.split(".")[0];
  return vendorFromDomain.charAt(0).toUpperCase() + vendorFromDomain.slice(1);
};