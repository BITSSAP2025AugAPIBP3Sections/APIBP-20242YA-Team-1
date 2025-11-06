export const detectVendor = (fromEmail = "") => {
  const emailMatch = fromEmail.match(/<(.+?)>/) || [null, fromEmail];
  const email = emailMatch[1].trim().toLowerCase();
   // Validate email format
  if (!email || !email.includes("@")) {
    return "Unknown";
  }

  const [username, domain] = email.split("@");

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