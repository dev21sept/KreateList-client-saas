/**
 * Wraps content in a professional eBay template
 */
const wrapInTemplate = (content, title = 'Product Details') => {
    if (!content) return "";
    
    // Check if already templated
    if (content.includes('ebay-template-container')) return content;

    return `
<div id="ds_div" class="ebay-template-container" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 900px; margin: 20px auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937; line-height: 1.6; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
    <div style="margin-bottom: 25px; border-bottom: 2px solid #4f46e5; padding-bottom: 15px;">
        <h2 style="margin: 0; color: #4f46e5; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${title}</h2>
    </div>
    <div class="description-content" style="font-size: 16px;">
        ${content}
    </div>
</div>`.trim();
};
 
/**
 * Ensures description does not exceed eBay's 4000 character limit by stripping HTML and wrapping in a minimal layout if too long.
 */
const sanitizeEbayDescription = (description) => {
    if (!description) return "";
    
    // Always clean up any external elister.ai logos/text and links to avoid eBay policy violations
    let clean = description;
    
    // Remove the elister signature footer components if they are there
    clean = clean.replace(/This Listing is Created By\s*<img[^>]+elister\.ai[^>]+>/gi, '');
    clean = clean.replace(/This Listing is Created By\s*elister\.ai/gi, '');
    clean = clean.replace(/<img[^>]+elister\.ai\/logo\.png[^>]+>/gi, '');
    clean = clean.replace(/<div[^>]*>\s*This Listing is Created By[\s\S]*?<\/div>/gi, '');
    
    // Convert any external anchor/link tags to pure text (eBay prohibits external links)
    clean = clean.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>(.*?)<\/a>/gi, '$3');

    // Strip social media handles, website/contact references, and other platforms to prevent policy violations
    clean = clean.replace(/(?:website|web|site|url|link|ig|instagram|facebook|fb|poshmark|depop|mercari|vinted|etsy|email|contact|phone|tel):\s*[^\s<]+/gi, '');
    clean = clean.replace(/@[a-zA-Z0-9_.-]+/g, '');
    clean = clean.replace(/\b(poshmark|depop|mercari|vinted|etsy)\b/gi, '');

    // Strip domain names / web URLs (e.g. shopwithazora.online -> shopwithazora) to avoid eBay link policy violations
    clean = clean.replace(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+)\.(online|com|org|net|store|edu|gov|co|info|biz|io|us|uk|in|de|ca|fr|au|ru|it|nl|br|es|ch|se|no|pl|co\.uk|ai|xyz)/gi, '$1');

    if (clean.length <= 4000) {
        return clean;
    }

    console.warn(`[Description Sanitizer] Description exceeds 4000 characters (${clean.length} chars). Truncating...`);

    // Strip HTML tags
    const cleanText = clean
        .replace(/<[^>]*>?/gm, ' ')   // replace HTML tags with spaces
        .replace(/\s+/g, ' ')          // collapse multiple spaces
        .trim();

    // If clean text is still too long, truncate it
    const limit = 3800;
    const truncatedText = cleanText.length > limit 
        ? cleanText.substring(0, limit) + '...'
        : cleanText;

    // Wrap in a minimal HTML container
    return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">${truncatedText}</div>`;
};

module.exports = { wrapInTemplate, sanitizeEbayDescription };
