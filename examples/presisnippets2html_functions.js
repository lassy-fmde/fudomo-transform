function escapeHtml(s) {
    const lookup = {
        '&': '&amp;',
        '\"': '&quot;',
        '\'': '&#39;',
        '\n': '&#x0a;',
        '<': '&lt;',
        '>': '&gt;'
    };
    return s.replace(/[&"'<>\n]/g, (c) => lookup[c]);
}

module.exports = {
  /**
   * Root.f:
   * @param header The "header" of this Root
   * @param body The "body" of this Root
   * @param footer The "footer" of this Root
   */
  Root_f: function(header, body, footer) {
    return header + body + footer;
  },

  /**
   * Root.header:
   */
  Root_header: function() {
    return `<html>
      <head>
        <link href="https://cdn.jsdelivr.net/npm/prismjs@1.17.1/themes/prism.css" rel="stylesheet" />
        <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet" />
        <style>
          body { margin: 2em 5em; }
          h1 { font-family: sans-serif; color: #444; font-size: 1.5rem; margin-bottom: 0; }
          h2 { font-family: sans-serif; color: #444; font-size: 1.0rem; }
          pre { border-radius: 3px; border: 1px solid #ccc; }
          div.slide { display: flex; flex-direction: column; align-items: flex-start; }
          div.code-snippet-container { display: flex; flex-direction: row; align-items: flex-start; }
          button { margin: 0.5em; padding: 0.5em; }
        </style>
      </head>
      <body>
        <script src="https://cdn.jsdelivr.net/npm/prismjs@1.17.1/components/prism-core.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/prismjs@1.17.1/plugins/autoloader/prism-autoloader.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/clipboard@2/dist/clipboard.min.js"></script>`;
  },

  /**
   * Root.body:
   * @param cont_Slide_f {Array} The sequence of "f" values of Slide objects contained in this Root
   */
  Root_body: function(cont_Slide_f) {
    return cont_Slide_f.join('\n');
  },

  /**
   * Root.footer:
   */
  Root_footer: function() {
    return `
        <script>var clipboard = new ClipboardJS('.btn');</script>
      </body>
    </html>`;
  },

  /**
   * Slide.f:
   * @param header The "header" of this Slide
   * @param body The "body" of this Slide
   * @param footer The "footer" of this Slide
   */
  Slide_f: function(header, body, footer) {
    if (body.trim().length == 0) return '';
    return header + body + footer;
  },

  /**
   * Slide.header:
   * @param title The "title" of this Slide
   * @param activeSection The "activeSection" of this Slide
   */
  Slide_header: function(title, activeSection) {
    return `<h1>${activeSection}</h1>\n<h2>${title}</h2>\n<div class="slide">\n`;
  },

  /**
   * Slide.body:
   * TODO: Support for code in Bullets or in Verbatim (?)
   * @param cont_Code_val {Array} The sequence of Code scalar values contained in this Slide
   * @param cont_Column_code {Array} The sequence of "code" values of Column objects contained in this Slide
   */
  Slide_body: function(cont_Code_val, cont_Column_code) {
    // TODO order of Code/Column is not preserved.
    let res = '';
    for (const code of cont_Code_val.concat(cont_Column_code.filter(c => c !== null))) {
      res += `<div class="code-snippet-container">
                <pre><code class="language-python">${escapeHtml(code.toString())}</code></pre>
                <button class="btn" data-clipboard-text="${escapeHtml(code.toString())}" title="Copy to clipboard"><i class="fa fa-clone"></i></button>
              </div>\n`;
    }
    return res;
  },

  /**
   * Slide.footer:
   */
  Slide_footer: function() {
    return '</div>\n';
  },

  /**
   * Slide.activeSection:
   * @param _cont_Root_cont {Set} The set of "cont" values of Root objects that contain this Slide
   * @param center This Slide
   */
  Slide_activeSection: function(_cont_Root_cont, center) {
    // Find last section before center in contents, return its scalar value
    let activeSection = null;
    if (_cont_Root_cont.size > 0) {
      const root_contents_array = _cont_Root_cont.values().next().value;
      for (const content of root_contents_array) {
        if (content.type == 'Section') {
          activeSection = content.scalar;
        }
        if (content.comparable === center.comparable) {
          break;
        }
      }
    }
    return activeSection;
  },

  /**
   * Column.code:
   * @param cont_Code_val {Array} The sequence of Code scalar values contained in this Column
   */
  Column_code: function(cont_Code_val) {
    if (cont_Code_val.length == 0) return null;
    return cont_Code_val;
  },
};
