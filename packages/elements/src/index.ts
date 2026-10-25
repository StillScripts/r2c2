import { SiteForm } from "./site-form"

if (!customElements.get("site-form"))
  customElements.define("site-form", SiteForm)
