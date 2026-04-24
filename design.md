**Product Vision**

A retro-aesthetic Pomodoro productivity timer for the web, visually inspired by the iconic Twemco split-flap clock from Hong Kong. The app blends the tactile nostalgia of analog flip-clock displays with modern browser capabilities to create a focused, distraction-free work-session tool that resonates with young adult users who value both aesthetics and function.

**Design Philosophy**

- Split-flap visual language drawn directly from Twemco BQ-170 and QT-30clock families
- Cream as the hero default colorway — warm, paper-like, intentionally analog
- Typography rooted in monospaced / mechanical letterforms to reinforce the clock metaphor
- Motion restrained and purposeful — every animation earns its place
- Accessibility-first: the visual design must not come at the cost of usability

**Primary Audience — The Aesthetic Achiever**

Age 18–34 · Students, freelancers, remote knowledge workers · Heavy social-media consumers with a trained eye for design · Drawn to lo-fi playlists, vintage electronics, and curated digital workspaces. 

**Technology : will need to have the following**

- **Index html : baseline structure,** clean semantic shell 
- **CSS :** All visual complexity
  - create a base color palette and a set of token using semantic naming to capture intentions as a reference the base template as things get built
   
- **Script.js :** all behavior
  - **Template / Component Pattern — Flip Panel**
  The six digit panels (HH:MM:SS) and the colon separator share near-identical markup. Use a factory function to stamp them from a template rather than duplicating markup:
    - createFlipPanel — returns a DocumentFragment from an HTML template element
    - Split JS by concern when defining the interactions and functionality, make sure to separate into different concerns to make it easier to find the different sections
    - Include JSDOC-style comments
    - Use template or figure out a way to condense when there are repeat objects, instead of making identical markup
   
- **Accessibility :** Markup must communicate structure and intent to assistive technology without relying on visual presentation.
  - As applicable make sure to include Skip link, aria labels and attributes, and tab mechanism, haptic feedback
  - Make sure accessibility such as hit target size, color contrast and any other important accessibility issues on web and mobile considerations are taken into account
  - prefers-reduced-motion, prefers-reduced transparency

