(() => {
    const STORAGE_KEY = 'skillmarket-theme';
    const DARK = 'dark';
    const LIGHT = 'light';
    const root = document.documentElement;
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const storedTheme = (() => {
        try {
            const value = localStorage.getItem(STORAGE_KEY);
            return value === DARK || value === LIGHT ? value : null;
        } catch (_) {
            return null;
        }
    })();

    let followsSystem = !storedTheme;

    function preferredTheme() {
        return media && media.matches ? DARK : LIGHT;
    }

    function updateThemeColor(theme) {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = theme === DARK ? '#0b1020' : '#f6f8fc';
    }

    function updateButton(button, theme) {
        if (!button) return;
        const isDark = theme === DARK;
        button.setAttribute('aria-pressed', String(isDark));
        button.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
        button.setAttribute('title', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
        const label = button.querySelector('.theme-toggle-label');
        if (label) label.textContent = isDark ? 'Tema claro' : 'Tema escuro';
    }

    function applyTheme(theme, { persist = false, animate = false } = {}) {
        const next = theme === DARK ? DARK : LIGHT;
        if (animate) {
            root.classList.add('theme-changing');
            window.setTimeout(() => root.classList.remove('theme-changing'), 300);
        }
        root.dataset.theme = next;
        root.style.colorScheme = next;
        updateThemeColor(next);
        updateButton(document.getElementById('themeToggle'), next);

        if (persist) {
            followsSystem = false;
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (_) {
                // O tema continua funcionando mesmo quando o armazenamento está indisponível.
            }
        }
    }

    // Executa antes do CSS ser renderizado para evitar o clarão do tema claro.
    applyTheme(storedTheme || preferredTheme());

    function themeButtonMarkup() {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'themeToggle';
        button.className = 'theme-toggle';
        button.innerHTML = `
            <span class="theme-toggle-icons" aria-hidden="true">
                <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" focusable="false">
                    <circle cx="12" cy="12" r="3.6"></circle>
                    <path d="M12 2.3v2.1M12 19.6v2.1M4.4 4.4l1.5 1.5M18.1 18.1l1.5 1.5M2.3 12h2.1M19.6 12h2.1M4.4 19.6l1.5-1.5M18.1 5.9l1.5-1.5"></path>
                </svg>
                <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" focusable="false">
                    <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.8 8.8 0 1 0 20.2 15.1Z"></path>
                </svg>
            </span>
            <span class="theme-toggle-label">Tema escuro</span>`;
        return button;
    }



    function passwordToggleMarkup() {
        return `
            <svg class="password-eye password-eye--show" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
                <circle cx="12" cy="12" r="2.7"></circle>
            </svg>
            <svg class="password-eye password-eye--hide" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3 3l18 18"></path>
                <path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.8"></path>
                <path d="M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.9-.4 4.1-1"></path>
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
            </svg>`;
    }

    function mountPasswordToggles() {
        document.querySelectorAll('input[type="password"]').forEach(input => {
            if (input.closest('.password-input-wrap')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'password-input-wrap';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'password-toggle';
            button.setAttribute('aria-label', 'Mostrar senha');
            button.setAttribute('title', 'Mostrar senha');
            button.setAttribute('aria-pressed', 'false');
            button.innerHTML = passwordToggleMarkup();
            wrapper.appendChild(button);

            button.addEventListener('click', () => {
                const showing = input.type === 'text';
                input.type = showing ? 'password' : 'text';
                button.classList.toggle('is-visible', !showing);
                button.setAttribute('aria-pressed', String(!showing));
                button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
                button.setAttribute('title', showing ? 'Mostrar senha' : 'Ocultar senha');
                input.focus({ preventScroll: true });
                try {
                    const end = input.value.length;
                    input.setSelectionRange(end, end);
                } catch (_) {}
            });
        });
    }

    function mountToggle() {
        if (document.getElementById('themeToggle')) return;
        const button = themeButtonMarkup();
        const headerActions = document.querySelector('.header-geral');
        const profile = headerActions?.querySelector('.perfil-header');

        if (headerActions) {
            button.classList.add('theme-toggle--header');
            if (profile) headerActions.insertBefore(button, profile);
            else headerActions.appendChild(button);
        } else {
            button.classList.add('theme-toggle--floating');
            document.body.appendChild(button);
        }

        updateButton(button, root.dataset.theme || LIGHT);
        button.addEventListener('click', () => {
            const next = root.dataset.theme === DARK ? LIGHT : DARK;
            applyTheme(next, { persist: true, animate: true });
        });
    }

    function mountInterfaceUtilities() {
        mountToggle();
        mountPasswordToggles();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountInterfaceUtilities, { once: true });
    } else {
        mountInterfaceUtilities();
    }

    if (media) {
        const onSystemThemeChange = event => {
            if (followsSystem) applyTheme(event.matches ? DARK : LIGHT);
        };
        if (typeof media.addEventListener === 'function') media.addEventListener('change', onSystemThemeChange);
        else if (typeof media.addListener === 'function') media.addListener(onSystemThemeChange);
    }
})();
