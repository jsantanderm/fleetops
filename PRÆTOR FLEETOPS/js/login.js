const loginForm =
    document.getElementById("loginForm");

const googleButton =
    document.getElementById("googleButton");

const loginError =
    document.getElementById("loginError");

const loginTitle =
    document.getElementById("loginTitle");

const loginCopy =
    document.getElementById("loginCopy");

const emailButton =
    document.getElementById("emailButton");

const modeButton =
    document.getElementById("modeButton");

const loginFormElements = [
    loginForm,
    googleButton,
    modeButton,
    document.querySelector(".login-divider")
];

const organizationPanel =
    document.getElementById("organizationPanel");

const organizationList =
    document.getElementById("organizationList");

const organizationTitle =
    document.getElementById("organizationTitle");

const organizationCopy =
    document.querySelector(".organization-copy");

const organizationError =
    document.getElementById("organizationError");

const organizationBackButton =
    document.getElementById("organizationBackButton");

let isSignUpMode = false;

function getNextPath() {
    const requestedPath =
        new URLSearchParams(window.location.search).get("next");

    if (
        requestedPath &&
        requestedPath.startsWith("/") &&
        !requestedPath.startsWith("//")
    ) {
        return requestedPath;
    }

    return "dashboard.html";
}

function redirectAfterLogin() {
    window.location.replace(getNextPath());
}

function setLoginControlsVisible(visible) {
    loginFormElements.forEach(function (element) {
        if (element) {
            element.hidden = !visible;
        }
    });
}

function showOrganizationPanel() {
    organizationPanel.hidden = false;
    setLoginControlsVisible(false);
}

function showLoginPanel() {
    organizationPanel.hidden = true;
    setLoginControlsVisible(true);
    organizationError.innerText = "";
}

function renderOrganizations(organizations) {
    organizationList.innerHTML = "";

    organizations.forEach(function (organization) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "organization-button";
        button.innerText = organization.name || "Organización sin nombre";
        button.addEventListener("click", function () {
            setActiveOrganizationId(organization.id);
            redirectAfterLogin();
        });
        organizationList.appendChild(button);
    });
}

async function continueAfterAuthentication() {
    loginError.innerText = "";

    try {
        const context = await resolveOrganizationContext();

        if (context.organizations.length === 0) {
            clearActiveOrganizationId();
            showOrganizationPanel();
            organizationTitle.innerText = "Sin organización asignada";
            organizationCopy.innerText = "Tu usuario está autenticado, pero todavía no tiene una organización asignada.";
            organizationList.innerHTML = "";
            organizationError.innerText = "Contacta al administrador de tu operación para solicitar acceso.";
            return;
        }

        if (context.organizations.length === 1) {
            setActiveOrganizationId(context.organizations[0].id);
            redirectAfterLogin();
            return;
        }

        showOrganizationPanel();
        organizationTitle.innerText = "Selecciona una organización";
        organizationCopy.innerText = "Elige la organización que quieres abrir en la torre de control.";
        renderOrganizations(context.organizations);
    }
    catch (error) {
        console.error("PRÆTOR FleetOps: no fue posible resolver organizaciones", error);
        showOrganizationPanel();
        organizationTitle.innerText = "No se pudo cargar tu organización";
        organizationCopy.innerText = "La sesión existe, pero no fue posible consultar tus organizaciones.";
        organizationList.innerHTML = "";
        organizationError.innerText = "Intenta nuevamente o contacta al administrador de tu operación.";
    }
}

async function redirectIfAuthenticated() {
    const {
        data
    } =
        await supabaseClient.auth.getSession();

    if (data.session) {
        await continueAfterAuthentication();
    }
}

function setLoginMode(signUpMode) {

    isSignUpMode = signUpMode;
    loginTitle.innerText =
        signUpMode ? "Crear cuenta" : "Inicio de sesión";
    loginCopy.innerText =
        signUpMode
            ? "Crea el acceso de un operador de la torre de control."
            : "Acceso para operadores de la operación.";
    emailButton.innerText =
        signUpMode ? "CREAR CUENTA" : "INICIAR SESIÓN";
    modeButton.innerText =
        signUpMode
            ? "YA TENGO UNA CUENTA · INICIAR SESIÓN"
            : "SIGN UP · CREAR CUENTA";
    loginError.innerText = "";

}

modeButton.addEventListener("click", function () {
    setLoginMode(!isSignUpMode);
});

organizationBackButton.addEventListener("click", function () {
    showLoginPanel();
    setLoginMode(false);
});

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email =
        loginForm.elements["email"].value.trim();

    const password =
        loginForm.elements["password"].value;

    loginError.innerText = "";
    emailButton.disabled = true;

    if (isSignUpMode) {

        const redirectTo =
            `${window.location.origin}${window.location.pathname}?next=${encodeURIComponent(getNextPath())}`;

        const {
            data,
            error
        } =
            await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: redirectTo
                }
            });

        if (error) {
            loginError.innerText =
                "No fue posible crear la cuenta.";
            emailButton.disabled = false;
            return;
        }

        if (data.session) {
            await continueAfterAuthentication();
            return;
        }

        loginError.innerText =
            "Cuenta creada. Revisa tu email para confirmarla.";
        emailButton.disabled = false;
        return;
    }

    const {
        error
    } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        loginError.innerText =
            "No fue posible iniciar sesión. Revisa tus datos.";
        emailButton.disabled = false;
        return;
    }

    await continueAfterAuthentication();
});

googleButton.addEventListener("click", async function () {

    loginError.innerText = "";
    googleButton.disabled = true;
    googleButton.innerText = "CONECTANDO CON GOOGLE...";

    const redirectTo =
        `${window.location.origin}${window.location.pathname}?next=${encodeURIComponent(getNextPath())}`;

    const {
        error
    } =
        await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo
            }
        });

    if (error) {
        loginError.innerText =
            "Google no está disponible para este proyecto.";
        googleButton.disabled = false;
        googleButton.innerHTML =
            '<span class="google-mark">G</span> CONTINUAR CON GOOGLE';
    }
});

redirectIfAuthenticated();
