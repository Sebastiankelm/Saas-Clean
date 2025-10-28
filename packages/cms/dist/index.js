import { allBlogs, allFaqs, allTestimonials, allFeatures, } from '../.content-collections/generated/index.js';
function resolveLocale(locale) {
    const normalized = locale.toLowerCase();
    if (normalized === 'pl') {
        return 'pl';
    }
    return 'en';
}
export function getBlogPosts(locale) {
    const target = resolveLocale(locale);
    return allBlogs
        .filter((post) => post.locale === target)
        .sort((a, b) => a.publishedAt > b.publishedAt ? -1 : a.publishedAt < b.publishedAt ? 1 : 0);
}
export function getFaqEntries(locale) {
    const target = resolveLocale(locale);
    return allFaqs
        .filter((entry) => entry.locale === target)
        .sort((a, b) => a.order - b.order);
}
export function getTestimonials(locale) {
    const target = resolveLocale(locale);
    return allTestimonials.filter((testimonial) => testimonial.locale === target);
}
export function getFeatures(locale) {
    const target = resolveLocale(locale);
    return allFeatures
        .filter((feature) => feature.locale === target)
        .sort((a, b) => a.order - b.order);
}
