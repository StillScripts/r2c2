import { describe, expect, it } from "vite-plus/test"
import { extractForms } from "./forms"

describe("extractForms", () => {
  it("reads each site-form's fields", () => {
    const { forms, errors } = extractForms(`
<site-form name="contact"><form>
  <input name="name" required>
  <input name="email" type="email" maxlength="200">
  <textarea name="message" required maxlength="2000"></textarea>
  <select name="topic"><option>A</option></select>
  <input type="hidden" name="extra"><input type="submit" name="go"><button>Send</button>
</form></site-form>`)
    expect(errors).toEqual([])
    expect(forms).toEqual([
      {
        name: "contact",
        fields: [
          { name: "name", type: "text", required: true },
          { name: "email", type: "email", required: false, maxLength: 200 },
          {
            name: "message",
            type: "textarea",
            required: true,
            maxLength: 2000,
          },
          { name: "topic", type: "select", required: false },
        ],
      },
    ])
  })

  it("ignores fields outside a site-form", () => {
    expect(extractForms('<form><input name="q"></form>').forms).toEqual([])
  })

  it.each([
    [
      "a missing form name",
      '<site-form><input name="a"></site-form>',
      1,
      "<site-form> needs a name attribute.",
    ],
    [
      "a form name that isn't URL-safe",
      '<site-form name="Contact Us"><input name="a"></site-form>',
      1,
      'Form names use lowercase letters, numbers and hyphens, like "contact-us".',
    ],
    [
      "a duplicate form name",
      '<site-form name="c"></site-form>\n<site-form name="c"></site-form>',
      2,
      'There\'s already a form named "c" on this page.',
    ],
    [
      "a field without a name",
      '<site-form name="c">\n  <input></site-form>',
      2,
      "Fields in a form need a name attribute.",
    ],
    [
      "a duplicate field name",
      '<site-form name="c"><input name="a">\n<input name="a"></site-form>',
      2,
      'The form already has a field named "a".',
    ],
  ])("reports %s", (_, html, line, message) => {
    expect(extractForms(html).errors).toEqual([
      expect.objectContaining({ line, rule: "site-form", message }),
    ])
  })
})
