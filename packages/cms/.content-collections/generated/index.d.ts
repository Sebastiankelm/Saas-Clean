import configuration from "../../content.config.ts";
import { GetTypeByName } from "@content-collections/core";

export type Blog = GetTypeByName<typeof configuration, "blog">;
export declare const allBlogs: Array<Blog>;

export type Faq = GetTypeByName<typeof configuration, "faq">;
export declare const allFaqs: Array<Faq>;

export type Testimonial = GetTypeByName<typeof configuration, "testimonials">;
export declare const allTestimonials: Array<Testimonial>;

export type Feature = GetTypeByName<typeof configuration, "features">;
export declare const allFeatures: Array<Feature>;

export {};
