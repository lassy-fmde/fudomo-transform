import re
import math

def Root_f(header, body, footer):
    """    :param header: The "header" of this Root
    :param body: The "body" of this Root
    :param footer: The "footer" of this Root
    """
    return header + body + footer

def Root_header(cont_Lesson_print, cont_Lesson_course, cont_Lesson_number, cont_Lesson_teacher, cont_Lesson_institute, cont_Lesson_year):
    """
    :param cont_Lesson_print: The sequence of "print" values of Lesson objects contained in this Root
    :type  cont_Lesson_print: Array
    :param cont_Lesson_course: The sequence of "course" values of Lesson objects contained in this Root
    :type  cont_Lesson_course: Array
    :param cont_Lesson_number: The sequence of "number" values of Lesson objects contained in this Root
    :type  cont_Lesson_number: Array
    :param cont_Lesson_teacher: The sequence of "teacher" values of Lesson objects contained in this Root
    :type  cont_Lesson_teacher: Array
    :param cont_Lesson_institute: The sequence of "institute" values of Lesson objects contained in this Root
    :type  cont_Lesson_institute: Array
    :param cont_Lesson_year: The sequence of "year" values of Lesson objects contained in this Root
    :type  cont_Lesson_year: Array
    """
    res = ''
    if cont_Lesson_print[0] == 'yes':
        res += '\\documentclass[handout]{beamer}\n\
             \\usepackage{pgfpages}\n\
             \\pgfpagesuselayout{4 on 1}[a4paper,border shrink=5mm, landscape]\n\
             %\\renewcommand{\\tableofcontents}{}\n\
             \\setbeamertemplate{headline}{\\scriptsize{\\vspace*{0.3cm}\
             \\hspace*{0.3cm}\\insertframenumber}}\n'
    else:
        res += '\\documentclass{beamer}\n'

    res += '\\usepackage{listings}\n\
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
           \\title{' + cont_Lesson_course[0] + '}\n\
           \\subtitle{Lesson ' + str(cont_Lesson_number[0]) + '}\n\
           \\author{' + cont_Lesson_teacher[0] + '}\n\
           \\institute{' + cont_Lesson_institute[0] + '}\n\
           \\date{' + str(cont_Lesson_year[0]) + '}\n\
           \\begin{document}\n\
           \\begin{frame}\n\
           \\titlepage\n\
           \\end{frame}\n\
           \\begin{frame}\n\
           \\frametitle{Outline}\n\
           \\tableofcontents\n\
           \\end{frame}\n'

    return res

def Root_body(cont_Object_f):
    """
    :param cont_Object_f: The sequence of "f" values of Object objects contained in this Root
    :type  cont_Object_f: Array
    """
    return '\n'.join(s for s in cont_Object_f if s is not None)

def Root_footer():
    return '\\end{document}\n'

def Slide_f(header, body, footer):
    """
    :param header: The "header" of this Slide
    :param body: The "body" of this Slide
    :param footer: The "footer" of this Slide
    """
    return header + body + footer

def Slide_header(title, hasCode, activeSection, label):
    """
    :param title: The "title" of this Slide
    :param hasCode: The "hasCode" of this Slide
    :param activeSection: The "activeSection" of this Slide
    :param label: The "label" of this Slide
    """
    res = ''
    if hasCode:
        res += '\\begin{frame}[fragile]\n'
    else:
        res += '\\begin{frame}\n'

    if activeSection:
        res += '\\frametitle{' + activeSection + '}\n'

    if title:
        res += '\\framesubtitle{' + title + '}\n'

    if label:
        res += '\\label{' + label + '}\n'

    return res

def Slide_hasCode(cont_Bullets_hasCode, cont_Code_center, cont_Verbatim_center, cont_Column_hasCode):
    """
    :param cont_Bullets_hasCode: The sequence of "hasCode" values of Bullets objects contained in this Slide
    :type  cont_Bullets_hasCode: Array
    :param cont_Code_center: The sequence of Code objects contained in this Slide
    :type  cont_Code_center: Array
    :param cont_Verbatim_center: The sequence of Verbatim objects contained in this Slide
    :type  cont_Verbatim_center: Array
    :param cont_Column_hasCode: The sequence of "hasCode" values of Column objects contained in this Slide
    :type  cont_Column_hasCode: Array
    """
    anyBulletHasCode = any(bool(bulletHasCode) for bulletHasCode in cont_Bullets_hasCode)
    anyColumnHasCode = any(bool(columnHasCode) for columnHasCode in cont_Column_hasCode)
    return anyBulletHasCode or anyColumnHasCode or len(cont_Code_center) > 0 or len(cont_Verbatim_center) > 0

def Bullets_hasCode(val):
    """
    :param val: The value of this Bullets
    """
    return '\\lstinline' in val

def Slide_activeSection(_cont_Root_cont, center):
    """
    :param _cont_Root_cont: The set of "cont" values of Root objects that contain this Slide
    :type  _cont_Root_cont: Set
    :param center: This Slide
    """
    # Find last section before center in contents, return its scalar value
    activeSection = None
    if len(_cont_Root_cont) > 0:
        root_contents_array = _cont_Root_cont[0] # This is ok because there can be only one instance of Root
        for content in root_contents_array:
            if content.type == 'Section':
                activeSection = content.val

            if content == center:
                break

    return activeSection

def Slide_body(cont_Object_f):
    """
    :param cont_Object_f: The sequence of "f" values of Object objects contained in this Slide
    :type  cont_Object_f: Array
    """
    return '\n'.join(cont_Object_f)

def Slide_footer():
    return '\\end{frame}\n'

def Column_f(cont_Object_f, isFirst, width):
    """
    :param cont_Object_f: The sequence of "f" values of Object objects contained in this Column
    :type  cont_Object_f: Array
    :param isFirst: The "isFirst" of this Column
    :param width: The "width" of this Column
    """
    res = ''
    if isFirst:
        res += '\\begin{columns}\n'

    res += '\\begin{column}{' + width + '}\n'
    res += '\n'.join(cont_Object_f)
    res += '\\end{column}\n'
    if not isFirst:
        res += '\\end{columns}\n'

    return res

def Column_isFirst(_cont_Slide_firstCol, center):
    """
    :param _cont_Slide_firstCol: The set of "firstCol" values of Slide objects that contain this Column
    :type  _cont_Slide_firstCol: Set
    :param center: This Column
    """
    if len(_cont_Slide_firstCol) == 0:
        return False
    firstCol = _cont_Slide_firstCol[0]
    return firstCol == center

def Column_hasCode(cont_Code_center):
    """
    :param cont_Code_center: The sequence of Code objects contained in this Column
    :type  cont_Code_center: Array
    """
    return len(cont_Code_center) > 0

def Slide_firstCol(cont_Column_center):
    """
    :param cont_Column_center: The sequence of Column objects contained in this Slide
    :type  cont_Column_center: Array
    """
    return cont_Column_center[0]

def Block_f(name, text):
    """
    :param name: The "name" of this Block
    :param text: The "text" of this Block
    """
    return '\\begin{block}{' + name + '}\n' + text + '\n\\end{block}\n'

def Question_f(text):
    """
    :param text: The "text" of this Question
    """
    return '\\begin{block}{Question}\n' + text + '\n\\end{block}\n'

def Answer_f(text):
    """
    :param text: The "text" of this Answer
    """
    return '\\begin{block}{Answer}\n' + text + '\n\\end{block}\n'

def Discussion_f(text):
    """
    :param text: The "text" of this Discussion
    """
    return '\\begin{block}{Discussion}\n' + text + '\n\\end{block}\n'

def Law_f(text):
    """
    :param text: The "text" of this Law
    """
    return '\\begin{block}{Law}\n' + text + '\n\\end{block}\n'

def Figure_f(val):
    """
    :param val: The value of this Figure
    """
    return '\\begin{figure}\n' + val + '\n\\end{figure}\n'

def Problem_f(name, input, output):
    """
    :param name: The "name" of this Problem
    :param input: The "input" of this Problem
    :param output: The "output" of this Problem
    """
    res = '\\begin{example}\n'
    if name:
        res += '[' + name + ']\n'
    res += 'Input: ' + input + '\n'
    res += 'Output: ' + output + '\n'
    res += '\\end{example}\n'
    return res

def Code_f(val):
    """
    :param val: The value of this Code
    """
    return '\\begin{lstlisting}\n' + val + '\n\\end{lstlisting}\n'

def Bullets_f(val):
    """
    :param val: The value of this Bullets
    """
    INDENT = '  ' # must be whitespace

    # Function to get indentation level as integer number of
    # repetitions of INDENT.
    def getIndentation(s):
        indentation = re.match(r'[ \t]*', s).group(0)
        # indentation = s.match('[ \t]*').group()
        indentation = re.sub('\t', INDENT, indentation) # replace tabs by INDENT
        return math.floor(len(indentation) / len(INDENT))

    res = ''
    lines = val.strip().split('\n')
    if len(lines) == 0:
        return ''

    # Iterate over lines, keeping track of previous line's indentation
    previousIndentation = 0
    for line in lines:
        if not line.strip():
            continue
        currentIndentation = getIndentation(line) + 1

        # Current line is indented further than previous line, add "\begin{itemize}"
        # the appropriate number of times.
        if currentIndentation > previousIndentation:
            for i in range(previousIndentation, currentIndentation):
                res += INDENT * i + '\\begin{itemize}\n'

        # Current line is indented less than previous line, add "\end{itemize}"
        # the appropriate number of times.
        if currentIndentation < previousIndentation:
            for i in range(previousIndentation, currentIndentation, -1):
                res += INDENT * (i - 1) + '\\end{itemize}\n'

        # Output the current line
        res += INDENT * currentIndentation + '\\item ' + line.strip() + '\n'

        previousIndentation = currentIndentation

    # Final loop to add "\end{itemize}" the right number of times to close
    # the bulleted list properly.
    if previousIndentation > 0:
        for i in range(previousIndentation, 0, -1):
            res += INDENT * (i - 1) + '\\end{itemize}\n'

    return res

def Bullet_f(val):
    """
    :param val: The value of this Bullet
    """
    return '\\begin{itemize}\n  \\item ' + val + '\n\\end{itemize}\n'

def Nobullet_f(val):
    """
    :param val: The value of this Nobullet
    """
    return val.strip() + '\n'

def Verbatim_f(val):
    """
    :param val: The value of this Verbatim
    """
    return '\\begin{verbatim}\n  \\item ' + val + '\n\\end{verbatim}\n'

def Section_f(val):
    """
    :param val: The value of this Section
    """
    return '\\section{' + val + '}'

def Table_f(val):
    """
    :param val: The value of this Table
    """
    result = ''

    lines = val.split('\n')
    numCols = len(lines[0].split('&'))
    result += '\\begin{table}[]\n'
    result += '\\begin{tabular}{' + ('l' * numCols) + '}\n'

    for i, line in enumerate(lines):
        result += line

        if i < len(lines.length - 1):
            result += '\\\\\n'

    result += '\\end{tabular}\n'
    result += '\\end{table}\n'

    return result
