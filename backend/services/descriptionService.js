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
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; font-style: italic; display: flex; align-items: center; gap: 10px;">
        <div style="width: 8px; height: 8px; background-color: #4f46e5; border-radius: 50%;"></div>
        <span>Thank you for shopping with us! Fast shipping & professional handling guaranteed.</span>
    </div>
</div>`.trim();
};

module.exports = { wrapInTemplate };
