module.exports = {
  /**
   * Doc.f:
   * @param header The "header" of this Doc
   * @param body The "body" of this Doc
   * @param footer The "footer" of this Doc
   */
  Root_f: function(header, body, footer) {
    return header + body + footer;
  },

  /**
   * Doc.header:
   * @param cont_Lesson_print {Array} The sequence of "print" values of Lesson
   *                                  objects contained in this Doc
   * @param cont_Lesson_course {Array} The sequence of "course" values of Lesson
   *                                   objects contained in this Doc
   * @param cont_Lesson_number {Array} The sequence of "number" values of Lesson
   *                                   objects contained in this Doc
   * @param cont_Lesson_teacher {Array} The sequence of "teacher" values of Lesson
   *                                    objects contained in this Doc
   * @param cont_Lesson_institute {Array} The sequence of "institute" values of
   *                                      Lesson objects contained in this Doc
   * @param cont_Lesson_year {Array} The sequence of "year" values of Lesson
   *                                 objects contained in this Doc
   */
  Root_header: function(cont_Lesson_print, cont_Lesson_course, cont_Lesson_number,
                       cont_Lesson_teacher, cont_Lesson_institute, cont_Lesson_year) {
    let res = '';
    if (cont_Lesson_print[0] == 'yes') {
     res += '\\documentclass[handout]{beamer}\n\
             \\usepackage{pgfpages}\n\
             \\pgfpagesuselayout{4 on 1}[a4paper,border shrink=5mm, landscape]\n\
             %\\renewcommand{\\tableofcontents}{}\n\
             \\setbeamertemplate{headline}{\\scriptsize{\\vspace*{0.3cm}\
             \\hspace*{0.3cm}\\insertframenumber}}\n';
    } else {
     res += '\\documentclass{beamer}\n';
    }

    res += `\\usepackage{listings}\n\
           \\usepackage{caption}\n\
           \\captionsetup[figure]{labelformat=empty}\n\
           \\mode<presentation>\n\
           %TODO look up details - add to notes\n\
           \\useoutertheme[]{miniframes}\n\
           \\setbeamertemplate{footline}[frame number]\n\
           \\lstset{language=Python,\n\
               basicstyle=\\ttfamily\\bfseries,\n\
               commentstyle=\\color{red}\\itshape,\n\
               %stringstyle=\\color{green},\n\
               showstringspaces=false,\n\
               keywordstyle=\\color{blue}\\bfseries,\n\
               escapeinside={($*}{*$)},\n\
               columns=flexible    % to reduce letter spacing\n\
           }%eat leading white spaces\n\
           \\title{${cont_Lesson_course}}\n\
           \\subtitle{Lesson ${cont_Lesson_number}}\n\
           \\author{${cont_Lesson_teacher}}\n\
           \\institute{${cont_Lesson_institute}}\n\
           \\date{${cont_Lesson_year}}\n\
           \\begin{document}\n\
           \\begin{frame}\n\
           \\titlepage\n\
           \\end{frame}\n\
           \\begin{frame}\n\
           \\frametitle{Outline}\n\
           \\tableofcontents\n\
           \\end{frame}\n`;

    return res;
  },

  /**
   * Doc.body:
   * @param cont_Slide_f {Array} The sequence of "f" values of Slide objects
   *                             contained in this Doc
   */
  Root_body: function(cont_Slide_f) {
    return cont_Slide_f.join('\n');
  },

  /**
   * Doc.footer:
   */
  Root_footer: function() {
    return '\\end{document}\n';
  },

  /**
   * Slide.f:
   * @param header The "header" of this Slide
   * @param body The "body" of this Slide
   * @param footer The "footer" of this Slide
   */
  Slide_f: function(header, body, footer) {
    return header + body + footer;
  },

  /**
   * Slide.header:
   * @param title The "title" of this Slide
   * @param hasCode The "hasCode" of this Slide
   * @param activeSection The "activeSection" of this Slide
   * @param label The "label" of this Slide
   */
  Slide_header: function(title, hasCode, activeSection, label) {
    let res = '';
    if (hasCode) {
      res += '\\begin{frame}[fragile]\n';
    } else {
      res += '\\begin{frame}\n';
    }
    if (activeSection) {
      res += `\\frametitle{${activeSection}}\n`;
    }
    if (title) {
      res += `\\framesubtitle{${title}}\n`;
    }
    if (label) {
      res += `\\label{${label}}\n`;
    }
    return res;
  },

  /**
   * Slide.hasCode:
   * @param cont_Bullets_hasCode {Array} The sequence of "hasCode" values of
   *                                     Bullets objects contained in this Slide
   * @param cont_Code_center {Array} The sequence of Code objects contained in
   *                                 this Slide
   * @param cont_Verbatim_center {Array} The sequence of Verbatim objects
   *                                     contained in this Slide
   * @param cont_Column_hasCode {Array} The sequence of "hasCode" values of
   *                                    Column objects contained in this Slide
   */
  Slide_hasCode: function(cont_Bullets_hasCode, cont_Code_center,
                          cont_Verbatim_center, cont_Column_hasCode) {
    let anyBulletHasCode = false;
    for (const bulletHasCode of cont_Bullets_hasCode) {
      if (bulletHasCode) {
        anyBulletHasCode = true;
      }
    }

    let anyColumnHasCode = false;
    for (const columnHasCode of cont_Column_hasCode) {
      if (columnHasCode) {
        anyColumnHasCode = true;
      }
    }

    return anyBulletHasCode
           || anyColumnHasCode
           || cont_Code_center.length > 0
           || cont_Verbatim_center.length > 0;
  },

  /**
   * Bullets.hasCode:
   * @param val The value of this Bullets
   */
  Bullets_hasCode: function(val) {
    return val.includes('\\lstinline');
  },

  /**
   * Slide.activeSection:
   * @param _cont_Root_cont {Set} The set of "cont" values of Root objects that
   *                             contain this Slide
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
   * Slide.body:
   * @param cont_Object_f {Array} The sequence of "f" values of Object objects
   *                              contained in this Slide
   */
  Slide_body: function(cont_Object_f) {
    return cont_Object_f.join('\n');
  },

  /**
   * Slide.footer:
   */
  Slide_footer: function() {
    return '\\end{frame}\n';
  },

  /**
   * Column.f:
   * @param cont_Object_f {Array} The sequence of "f" values of Object objects
   *                              contained in this Column
   * @param isFirst The "isFirst" of this Column
   * @param width The "width" of this Column
   */
  Column_f: function(cont_Object_f, isFirst, width) {
    let res = '';
    if (isFirst) {
      res += '\\begin{columns}\n';
    }
    res += `\\begin{column}{${width}}\n`;
    res += cont_Object_f;
    res += '\\end{column}\n';
    if (!isFirst) {
      res += '\\end{columns}\n';
    }
    return res;
  },

  /**
   * Column.isFirst:
   * @param _cont_Slide_firstCol {Set} The set of "firstCol" values of Slide
   *                                   objects that contain this Column
   * @param center This Column
   */
  Column_isFirst: function(_cont_Slide_firstCol, center) {
    const firstCol = _cont_Slide_firstCol.values().next().value;
    return firstCol.comparable === center.comparable;
  },

  /**
   * Column.hasCode:
   * @param cont_Code_center {Array} The sequence of Code objects contained in
   *                                 this Column
   */
  Column_hasCode: function(cont_Code_center) {
    return cont_Code_center.length > 0;
  },

  /**
   * Slide.firstCol:
   * @param cont_Column_center {Array} The sequence of Column objects contained
   *                                   in this Slide
   */
  Slide_firstCol: function(cont_Column_center) {
    return cont_Column_center[0];
  },

  /**
   * Block.f:
   * @param name The "name" of this Block
   * @param text The "text" of this Block
   */
  Block_f: function(name, text) {
    return `\\begin{block}{${name}}\n${text}\n\\end{block}\n`;
  },

  /**
   * Question.f:
   * @param text The "text" of this Question
   */
  Question_f: function(text) {
    return `\\begin{block}{Question}\n${text}\n\\end{block}\n`;
  },

  /**
   * Answer.f:
   * @param text The "text" of this Answer
   */
  Answer_f: function(text) {
    return `\\begin{block}{Answer}\n${text}\n\\end{block}\n`;
  },

  /**
   * Discussion.f:
   * @param text The "text" of this Discussion
   */
  Discussion_f: function(text) {
    return `\\begin{block}{Discussion}\n${text}\n\\end{block}\n`;
  },

  /**
   * Law.f:
   * @param text The "text" of this Law
   */
  Law_f: function(text) {
    return `\\begin{block}{Law}\n${text}\n\\end{block}\n`;
  },

  /**
   * Figure.f:
   * @param val The value of this Figure
   */
  Figure_f: function(val) {
    return `\\begin{figure}\n${val}\n\\end{figure}\n`;
  },

  /**
   * Problem.f:
   * @param name The "name" of this Problem
   * @param input The "input" of this Problem
   * @param output The "output" of this Problem
   */
  Problem_f: function(name, input, output) {
    let res = '\\begin{example}\n';
    if (name != undefined) {
      res += `[${name}]\n`;
    }
    res += `Input: ${input}\n`;
    res += `Output: ${output}\n`;
    res += '\\end{example}\n';
    return res;
  },

  /**
   * Code.f:
   * @param val The value of this Code
   */
  Code_f: function(val) {
    return `\\begin{lstlisting}\n${val}\n\\end{lstlisting}\n`;
  },

  /**
   * Bullets.f:
   * @param val The value of this Bullets
   */
  Bullets_f: function(val) {
    const INDENT = '  '; // must be whitespace

    /** Function to get indentation level as integer number of
     * repetitions of INDENT.
     */
    function getIndentation(s) {
      let indentation = s.match(/[ \t]*/)[0];
      indentation = indentation.replace(/\t/g, INDENT); // replace tabs by INDENT
      return Math.floor(indentation.length / INDENT.length);
    }

    let res = '';
    const lines = val.trim().split('\n');
    if (lines.length == 0) return '';

    // Iterate over lines, keeping track of previous line's indentation
    let previousIndentation = 0;
    for (const line of lines) {
      if (line.trim().length == 0) continue;
      const currentIndentation = getIndentation(line) + 1;

      // Current line is indented further than previous line, add "\begin{itemize}"
      // the appropriate number of times.
      if (currentIndentation > previousIndentation) {
        for (let i = previousIndentation; i < currentIndentation; i++) {
          res += INDENT.repeat(i) + '\\begin{itemize}\n';
        }
      }

      // Current line is indented less than previous line, add "\end{itemize}"
      // the appropriate number of times.
      if (currentIndentation < previousIndentation) {
        for (let i = previousIndentation; i > currentIndentation; --i) {
          res += INDENT.repeat(i - 1) + '\\end{itemize}\n';
        }
      }

      // Output the current line
      res += INDENT.repeat(currentIndentation) + '\\item ' + line.trim() + '\n';

      previousIndentation = currentIndentation;
    }

    // Final loop to add "\end{itemize}" the right number of times to close
    // the bulleted list properly.
    if (previousIndentation > 0) {
      for (let i = previousIndentation; i > 0; --i) {
        res += INDENT.repeat(i - 1) + '\\end{itemize}\n';
      }
    }
    return res;
  },

  /**
   * Bullet.f:
   * @param val The value of this Bullet
   */
  Bullet_f: function(val) {
    return `\\begin{itemize}\n  \\item ${val}\n\\end{itemize}\n`;
  },

  /**
   * NoBullets.f:
   * @param val The value of this NoBullets
   */
  Nobullet_f: function(val) {
    return val.trim() + '\n';
  },

  /**
   * Verbatim.f:
   * @param val The value of this Verbatim
   */
  Verbatim_f: function(val) {
    return `\\begin{verbatim}\n\\item ${val}\n\\end{verbatim}\n`;
  },

  /**
   * Section.f:
   * @param val The value of this Section
   */
  Section_f: function(val) {
    return `\\section{${val}}`;
  },

  /**
   * Table.f:
   * @param val The value of this Table
   */
  Table_f: function(val) {
    let result = '';

    const lines = val.split('\n');
    const numCols = lines[0].split('&').length;
    result += '\\begin{table}[]\n';
    result += `\\begin{tabular}{${'l'.repeat(numCols)}}\n`;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      result += line;

      if (i < lines.length - 1) {
        result += '\\\n';
      }
    }

    result += '\\end{tabular}\n';
    result += '\\end{table}\n';

    return result;
  },
};
