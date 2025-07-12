exports.validateGSTIN = (gstin) => {
  if (!gstin) return false;
  
  // Basic GSTIN format validation
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  
  return gstRegex.test(gstin);
};