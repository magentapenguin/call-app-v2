export function html(strings: TemplateStringsArray, ...values: any[]): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
    return template.content;
}