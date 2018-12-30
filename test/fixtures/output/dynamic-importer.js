import componentStyles1 from './less/component-1.less';

let componentStyle2 = null;

import('./dynamic-importee')
    .then(({ default: dynamicImporteeStyles }) => {
        componentStyle2 = dynamicImporteeStyles;
    });

export default {
    componentStyles1,
    getComponentStyles2() {
        return componentStyle2;
    }
}
