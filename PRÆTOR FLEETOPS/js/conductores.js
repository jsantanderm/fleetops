const routePool =
    document.getElementById("routePool");

const completedPool =
    document.getElementById("completedPool");

const poolCount =
    document.getElementById("poolCount");

const operationalCount =
    document.getElementById("operationalCount");

const connectionIndicator =
    document.getElementById("connectionIndicator");

const connectionText =
    document.getElementById("connectionText");

const assignmentModal =
    document.getElementById("assignmentModal");

const assignmentForm =
    document.getElementById("assignmentForm");

const assignmentError =
    document.getElementById("assignmentError");

const assignmentDriver =
    document.getElementById("assignmentDriver");

const assignmentConductorId =
    document.getElementById("assignmentConductorId");

const assignmentRouteName =
    document.getElementById("assignmentRouteName");

const assignmentRoute =
    document.getElementById("assignmentRoute");

const assignmentCompany =
    document.getElementById("assignmentCompany");

const driverProfileModal =
    document.getElementById("driverProfileModal");

const driverProfileDriver =
    document.getElementById("driverProfileDriver");

const driverProfileContent =
    document.getElementById("driverProfileContent");

const closeDriverProfileButton =
    document.getElementById("closeDriverProfile");

let currentConductors = [];
let currentTrips = [];
let currentRoutes = [];
let currentConductorDocuments = [];
let currentTractoDocuments = [];
let activeOrganizationId = null;
let activeOrganization = null;

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setConnectionStatus(connected) {
    connectionIndicator.classList.toggle("connected", connected);
    connectionIndicator.classList.toggle("disconnected", !connected);
    connectionText.innerText = connected
        ? "CONNECTED"
        : "DATABASE ERROR";
}

async function initializeOperatorSession() {

    const context = await resolveOrganizationContext();

    if (!context.session || !context.activeOrganization) {
        window.location.replace(
            `login.html?next=${encodeURIComponent(window.location.pathname)}`
        );
        return false;
    }

    activeOrganizationId = context.activeOrganization.id;
    activeOrganization = context.activeOrganization;

    return true;

}

function getAssignmentByDriver(trips) {
    const assignments = {};

    trips.forEach(function (trip) {
        if (!trip.conductor_id || trip.fecha_finalizacion) {
            return;
        }

        if (!assignments[trip.conductor_id]) {
            assignments[trip.conductor_id] = trip;
        }
    });

    return assignments;
}

function normalizePlate(value) {
    return String(value || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
}

function openAssignment(conductor) {

    const activeAssignment =
        getAssignmentByDriver(currentTrips)[conductor.id];

    if (activeAssignment) {
        alert("Este conductor ya tiene un viaje activo.");
        return;
    }

    assignmentConductorId.value = conductor.id;
    assignmentDriver.innerText =
        `${conductor.driver_id} · ${conductor.nombre}`;
    assignmentForm.reset();
    assignmentConductorId.value = conductor.id;
    assignmentError.innerText = "";
    assignmentModal.hidden = false;

}

function closeAssignment() {
    assignmentModal.hidden = true;
}

function renderEmpty(title, text) {
    routePool.innerHTML = `
        <div class="empty-state">
            <div class="empty-code">NO DATA</div>
            <div class="empty-title">${escapeHTML(title)}</div>
            <div class="empty-text">${escapeHTML(text)}</div>
        </div>
    `;
}

function renderCompletedPools(trips) {

    const completedByRoute = {};

    trips
        .filter(function (trip) {
            return Boolean(trip.fecha_finalizacion) && trip.empresa_id === activeOrganizationId;
        })
        .forEach(function (trip) {
            const routeName = trip.ruta || "SIN RUTA ASOCIADA";

            if (!completedByRoute[routeName]) {
                completedByRoute[routeName] = [];
            }

            completedByRoute[routeName].push(trip);
        });

    if (Object.keys(completedByRoute).length === 0) {
        completedPool.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">SIN VIAJES FINALIZADOS</div>
                <div class="empty-text">Los conductores aparecerán aquí al finalizar una operación.</div>
            </div>
        `;
        return;
    }

    completedPool.innerHTML = Object.entries(completedByRoute).map(function ([routeName, tripsForRoute]) {
        return `
            <section class="route-group completed-route-group">
                <div class="route-group-header">
                    <div class="route-name">${escapeHTML(routeName)}</div>
                    <div class="route-count">${tripsForRoute.length} FINALIZADO${tripsForRoute.length === 1 ? "" : "S"}</div>
                </div>
                <div class="route-driver-list">
                    ${tripsForRoute.map(function (trip) {
                        return `
                            <article class="route-driver">
                                <div class="route-driver-top">
                                    <div>
                                        <div class="route-driver-id">${escapeHTML(trip.conductor || "SIN CONDUCTOR")}</div>
                                        <div class="route-driver-name">${escapeHTML(trip.patente || "SIN PATENTE")}</div>
                                    </div>
                                    <div class="route-driver-state">FINALIZADO</div>
                                </div>
                                <div class="route-driver-meta">VIAJE ${escapeHTML(trip.id)} · ${escapeHTML(trip.empresa || "SIN EMPRESA")}</div>
                                <button type="button" class="assignment-button reassign-button" data-conductor-id="${escapeHTML(trip.conductor_id || "")}">REASIGNAR</button>
                            </article>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    }).join("");

}

async function getDocumentSignedUrl(storagePath) {
    if (!storagePath) {
        return null;
    }

    const { data, error } = await supabaseClient.storage
        .from("fleetops-documents")
        .createSignedUrl(storagePath, 3600);

    if (error) {
        console.error("FLEETOPS DOCUMENT URL ERROR:", error);
        return null;
    }

    return data?.signedUrl || null;
}

async function openDriverProfile(driverId) {

    const conductor =
        currentConductors.find(function (item) {
            return item.id === driverId;
        });

    if (!conductor) {
        return;
    }

    const equipment =
        conductor.tracto || null;

    const conductorDocuments =
        currentConductorDocuments.filter(function (document) {
            return document.conductor_id === driverId;
        });

    const equipmentDocuments =
        equipment
            ? currentTractoDocuments.filter(function (document) {
                return document.tracto_id === equipment.id;
            })
            : [];

    const selfieDocument =
        conductorDocuments.find(function (document) {
            return document.tipo_documento === "selfie";
        });

    const selfieUrl =
        selfieDocument
            ? await getDocumentSignedUrl(selfieDocument.storage_path)
            : null;

    const driverDocuments =
        await Promise.all(
            conductorDocuments
                .filter(function (document) {
                    return document.tipo_documento !== "selfie";
                })
                .map(async function (document) {
                    return {
                        ...document,
                        signedUrl: await getDocumentSignedUrl(document.storage_path)
                    };
                })
        );

    const equipmentDocumentUrls =
        await Promise.all(
            equipmentDocuments.map(async function (document) {
                return {
                    ...document,
                    signedUrl: await getDocumentSignedUrl(document.storage_path)
                };
            })
        );

    driverProfileDriver.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
            ${
                selfieUrl
                    ? `
                        <img
                            src="${escapeHTML(selfieUrl)}"
                            alt="Foto de ${escapeHTML(conductor.nombre || "conductor")}"
                            style="
                                width:96px;
                                height:96px;
                                border-radius:50%;
                                object-fit:cover;
                                border:2px solid rgba(255,255,255,0.15);
                            "
                        >
                    `
                    : `
                        <div
                            style="
                                width:96px;
                                height:96px;
                                border-radius:50%;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                background:#111;
                                color:#777;
                                font-size:12px;
                            "
                        >
                            SIN FOTO
                        </div>
                    `
            }

            <div>
                ${escapeHTML(conductor.driver_id)} · ${escapeHTML(conductor.nombre)}
            </div>
        </div>
    `;

    function renderDocumentCard(document) {

        const label =
            document.tipo_documento === "licencia_frente"
                ? "LICENCIA · FRENTE"
                : document.tipo_documento === "licencia_reverso"
                    ? "LICENCIA · REVERSO"
                    : document.tipo_documento === "permiso_circulacion"
                        ? "PERMISO DE CIRCULACIÓN"
                        : document.tipo_documento === "soap"
                            ? "SOAP"
                            : document.tipo_documento === "revision_tecnica"
                                ? "REVISIÓN TÉCNICA"
                                : document.tipo_documento === "padron_vehicular"
                                    ? "PADRÓN VEHICULAR"
                                    : String(document.tipo_documento || "DOCUMENTO").toUpperCase();

        if (!document.signedUrl) {
            return `
                <div class="driver-document-card">
                    <div class="driver-document-label">
                        ${escapeHTML(label)}
                    </div>
                    <div class="driver-document-unavailable">
                        NO DISPONIBLE
                    </div>
                </div>
            `;
        }

        const mimeType =
            String(document.mime_type || "").toLowerCase();

        const isImage =
            mimeType.startsWith("image/");

        if (isImage) {
            return `
                <div class="driver-document-card">
                    <div class="driver-document-label">
                        ${escapeHTML(label)}
                    </div>

                    <a
                        href="${escapeHTML(document.signedUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="driver-document-link"
                    >
                        <img
                            src="${escapeHTML(document.signedUrl)}"
                            alt="${escapeHTML(label)}"
                            class="driver-document-image"
                        >
                    </a>

                    <div class="driver-document-filename">
                        ${escapeHTML(document.nombre_archivo || "ARCHIVO")}
                    </div>
                </div>
            `;
        }

        return `
            <div class="driver-document-card">
                <div class="driver-document-label">
                    ${escapeHTML(label)}
                </div>

                <a
                    href="${escapeHTML(document.signedUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="driver-document-link"
                    style="display:flex; align-items:center; justify-content:center; min-height:120px; text-decoration:none;"
                >
                    <span style="font-size:14px; font-weight:600;">
                        ABRIR DOCUMENTO
                    </span>
                </a>

                <div class="driver-document-filename">
                    ${escapeHTML(document.nombre_archivo || "ARCHIVO")}
                </div>
            </div>
        `;
    }

    driverProfileContent.innerHTML = `
        <section class="profile-section">
            <div class="profile-section-title">IDENTIDAD</div>

            <div class="profile-grid">
                <div class="data-row">
                    <span class="data-label">NOMBRE</span>
                    <span class="data-value">${escapeHTML(conductor.nombre || "--")}</span>
                </div>

                <div class="data-row">
                    <span class="data-label">TELÉFONO</span>
                    <span class="data-value">${escapeHTML(conductor.telefono || "--")}</span>
                </div>

                <div class="data-row">
                    <span class="data-label">RUT</span>
                    <span class="data-value">${escapeHTML(conductor.rut || "--")}</span>
                </div>

                <div class="data-row">
                    <span class="data-label">CIUDAD</span>
                    <span class="data-value">${escapeHTML(conductor.ciudad || "--")}</span>
                </div>

                <div class="data-row">
                    <span class="data-label">LICENCIA</span>
                    <span class="data-value">${escapeHTML(conductor.tipo_licencia || "--")}</span>
                </div>

                <div class="data-row">
                    <span class="data-label">NÚMERO LICENCIA</span>
                    <span class="data-value">${escapeHTML(conductor.licencia || "--")}</span>
                </div>

                <div class="data-row">
                    <span class="data-label">VENCIMIENTO</span>
                    <span class="data-value">${escapeHTML(conductor.licencia_vencimiento || "--")}</span>
                </div>

                <div class="data-row">
                    <span class="data-label">ESTADO</span>
                    <span class="data-value">${escapeHTML(conductor.estado || "--")}</span>
                </div>
            </div>
        </section>

        <section class="profile-section">
            <div class="profile-section-title">EQUIPO</div>

            <div class="profile-grid">
                <div class="data-row">
                    <span class="data-label">PATENTE</span>
                    <span class="data-value">
                        ${escapeHTML(equipment?.patente || conductor.patente_habitual || "--")}
                    </span>
                </div>

                <div class="data-row">
                    <span class="data-label">ESTADO</span>
                    <span class="data-value">
                        ${escapeHTML(equipment?.estado || "--")}
                    </span>
                </div>
            </div>
        </section>

        <section class="profile-section">
            <div class="profile-section-title">DOCUMENTACIÓN DEL CONDUCTOR</div>

            <div class="driver-documents">
                ${
                    driverDocuments.length
                        ? driverDocuments.map(renderDocumentCard).join("")
                        : `
                            <div class="driver-document-unavailable">
                                SIN DOCUMENTOS
                            </div>
                        `
                }
            </div>
        </section>

        <section class="profile-section">
            <div class="profile-section-title">DOCUMENTACIÓN DEL EQUIPO</div>

            <div class="driver-documents">
                ${
                    equipmentDocumentUrls.length
                        ? equipmentDocumentUrls.map(renderDocumentCard).join("")
                        : `
                            <div class="driver-document-unavailable">
                                SIN DOCUMENTOS
                            </div>
                        `
                }
            </div>
        </section>
    `;

    driverProfileModal.hidden = false;
}

function renderDriverCards(drivers, includeAssignmentButtons) {
    return drivers.map(function ({ conductor, assignment }) {
        const state =
            assignment?.estado ||
            (conductor.estado === "Disponible"
                ? "Pendiente de asignación"
                : conductor.estado) ||
            "SIN ESTADO";

        return `
            <article class="route-driver">
                <div class="route-driver-top">
                    <div>
                        <div class="route-driver-id">${escapeHTML(conductor.driver_id)}</div>
                        <div class="route-driver-name">${escapeHTML(conductor.nombre)}</div>
                    </div>
                    <div>
                        <div class="route-driver-plate">
                            <span class="route-driver-plate-label">EQUIPO / PATENTE</span>
                            ${escapeHTML(conductor.tracto?.patente || conductor.patente_habitual || assignment?.patente || "SIN PATENTE")}
                        </div>
                        <div class="route-driver-state">${escapeHTML(state)}</div>
                    </div>
                </div>
                <div class="route-driver-meta">
                    ${escapeHTML(conductor.ciudad || "SIN CIUDAD")} · ${escapeHTML(conductor.tipo_licencia || "SIN LICENCIA")} · ${escapeHTML(conductor.telefono || "SIN TELEFONO")}
                </div>
                <button type="button" class="profile-button" data-conductor-id="${escapeHTML(conductor.id)}">VER PERFIL</button>
                ${includeAssignmentButtons ? `
                    <button type="button" class="assignment-button" data-conductor-id="${escapeHTML(conductor.id)}">ASIGNAR OPERACIÓN</button>
                ` : `
                    <button type="button" class="assignment-button" disabled>VIAJE ACTIVO</button>
                    <button type="button" class="assignment-button remove-route-button" data-trip-id="${escapeHTML(assignment.id)}">RETIRAR DE RUTA</button>
                `}
            </article>
        `;
    }).join("");
}

function renderGroupedDrivers(groups) {
    return Object.entries(groups).map(function ([routeName, drivers]) {
        return `
            <section class="route-group">
                <div class="route-group-header">
                    <div class="route-name">${escapeHTML(routeName)}</div>
                    <div class="route-count">${drivers.length} CONDUCTOR${drivers.length === 1 ? "" : "ES"}</div>
                </div>
                <div class="route-driver-list">
                    ${renderDriverCards(drivers, false)}
                </div>
            </section>
        `;
    }).join("");
}

function renderPools(conductors, trips, routes) {
    const activeTrips = trips.filter(function (trip) {
        return Boolean(trip.conductor_id) && !trip.fecha_finalizacion;
    });

    const globallyOccupiedIds = new Set(
        activeTrips.map(function (trip) {
            return trip.conductor_id;
        })
    );
    const operationalAssignments = activeTrips.filter(function (trip) {
        return trip.empresa_id === activeOrganizationId;
    });
    const operationalByDriver = getAssignmentByDriver(operationalAssignments);
    const freeDrivers = conductors
        .filter(function (conductor) {
            return !globallyOccupiedIds.has(conductor.id);
        })
        .map(function (conductor) {
            return { conductor, assignment: null };
        });
    const operationalDrivers = conductors
        .filter(function (conductor) {
            return Boolean(operationalByDriver[conductor.id]);
        })
        .map(function (conductor) {
            return {
                conductor,
                assignment: operationalByDriver[conductor.id]
            };
        });
    const operationalGroups = {};

    operationalDrivers.forEach(function (driver) {
        const route = currentRoutes.find(function (item) {
            return item.id === driver.assignment.route_id;
        });
        const routeName = route?.name || driver.assignment.ruta || "SIN RUTA ASOCIADA";
        if (!operationalGroups[routeName]) {
            operationalGroups[routeName] = [];
        }
        operationalGroups[routeName].push(driver);
    });

    currentConductors = conductors;
    currentTrips = trips;
    currentRoutes = routes;
    poolCount.innerText = freeDrivers.length;
    operationalCount.innerText = operationalDrivers.length;

    assignmentRoute.innerHTML = `<option value="">SIN RUTA ASIGNADA</option>` + routes
        .filter(function (route) {
            return route.organization_id === activeOrganizationId && route.active;
        })
        .map(function (route) {
            return `<option value="${escapeHTML(route.id)}">${escapeHTML(route.name)}</option>`;
        }).join("");

    const poolMarkup = freeDrivers.length
        ? `<div class="route-group"><div class="route-group-header"><div class="route-name">DISPONIBLES</div><div class="route-count">${freeDrivers.length} CONDUCTOR${freeDrivers.length === 1 ? "" : "ES"}</div></div><div class="route-driver-list">${renderDriverCards(freeDrivers, true)}</div></div>`
        : `<div class="empty-state"><div class="empty-title">POOL GLOBAL VACÍO</div><div class="empty-text">Todos los conductores tienen una operación activa.</div></div>`;
    const operationalMarkup = operationalDrivers.length
        ? renderGroupedDrivers(operationalGroups)
        : `<div class="empty-state"><div class="empty-title">SIN OPERATIVOS</div><div class="empty-text">No hay conductores activos en esta organización.</div></div>`;

    routePool.innerHTML = `
        <section class="pool-zone">
            <div class="pool-zone-header"><div class="pool-zone-title">POOL GLOBAL</div><div class="pool-zone-description">Conductores disponibles para nuevas operaciones.</div></div>
            <div class="route-pool">${poolMarkup}</div>
        </section>
        <section class="pool-zone">
            <div class="pool-zone-header"><div class="pool-zone-title">OPERATIVOS</div><div class="pool-zone-description">Conductores actualmente asignados a ${escapeHTML(activeOrganization.name || "la organización activa")}.</div></div>
            <div class="route-pool">${operationalMarkup}</div>
        </section>
    `;

    renderCompletedPools(trips);
}

async function loadDriverPool() {
    const [
        driversResponse,
        tripsResponse,
        routesResponse,
        conductorDocumentsResponse,
        tractoDocumentsResponse
    ] = await Promise.all([
        supabaseClient
            .from("conductores")
            .select("id, driver_id, rut, nombre, telefono, tipo_licencia, ciudad, patente_habitual, estado, tracto_id, licencia, licencia_vencimiento, tracto:tractos(id, patente, estado)"),

        supabaseClient
            .from("viajes")
            .select("id, conductor_id, route_id, empresa_id, patente, ruta, empresa, estado, fecha_inicio, fecha_finalizacion, created_at")
            .order("created_at", { ascending: false }),

        supabaseClient
            .from("routes")
            .select("id, organization_id, name, active")
            .eq("organization_id", activeOrganizationId)
            .order("name"),

        supabaseClient
            .from("conductor_documentos")
            .select("id, conductor_id, tipo_documento, storage_path, nombre_archivo, mime_type, tamano_bytes, estado_revision, fecha_carga")
            .order("fecha_carga", { ascending: false }),

        supabaseClient
            .from("tracto_documentos")
            .select("id, tracto_id, tipo_documento, storage_path, nombre_archivo, mime_type, tamano_bytes, estado_revision, fecha_carga")
            .order("fecha_carga", { ascending: false })
    ]);

    if (driversResponse.error) {
        throw new Error(driversResponse.error.message);
    }

    if (tripsResponse.error) {
        throw new Error(tripsResponse.error.message);
    }

    if (routesResponse.error) {
        throw new Error(routesResponse.error.message);
    }

    if (conductorDocumentsResponse.error) {
        throw new Error(conductorDocumentsResponse.error.message);
    }

    if (tractoDocumentsResponse.error) {
        throw new Error(tractoDocumentsResponse.error.message);
    }

    currentConductorDocuments =
        conductorDocumentsResponse.data || [];

    currentTractoDocuments =
        tractoDocumentsResponse.data || [];

    renderPools(
        driversResponse.data || [],
        tripsResponse.data || [],
        routesResponse.data || []
    );
}

assignmentRoute.addEventListener("change", function () {
    const route = currentRoutes.find(function (item) {
        return item.id === assignmentRoute.value;
    });
    assignmentRouteName.value = route?.name || "";
    assignmentCompany.value = activeOrganization?.name || "";
});

assignmentForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const conductor =
        currentConductors.find(function (item) {
            return item.id === assignmentConductorId.value;
        });

    const patente =
        normalizePlate(
            conductor?.tracto?.patente ||
            conductor?.patente_habitual ||
            ""
        );

    const route =
        currentRoutes.find(function (item) {
            return item.id === assignmentForm.elements["route_id"].value &&
                item.organization_id === activeOrganizationId &&
                item.active;
        });

    const ruta =
        route?.name || null;

        const empresa =
            assignmentCompany.value || null;

    const estado =
        assignmentForm.elements["estado"].value;

    if (!conductor || !route || !patente || !estado) {
        assignmentError.innerText = "Completa los datos de la operación.";
        return;
    }

    const activeAssignment =
        getAssignmentByDriver(currentTrips)[conductor.id];

    if (activeAssignment) {
        assignmentError.innerText = "Este conductor ya tiene un viaje activo.";
        return;
    }

    const submitButton =
        assignmentForm.querySelector(".assignment-submit");

    submitButton.disabled = true;
    assignmentError.innerText = "";

    const {
        error
    } =
        await supabaseClient
            .from("viajes")
            .insert({
                patente,
                conductor: conductor.nombre,
                conductor_id: conductor.id,
                route_id: route?.id || null,
                empresa_id: activeOrganizationId,
                empresa,
                ruta,
                estado,
                fecha_inicio: new Date().toISOString(),
                fecha_finalizacion: null
            });

    if (error) {
        assignmentError.innerText =
            "No fue posible crear el viaje.";
        submitButton.disabled = false;
        return;
    }

    closeAssignment();
    await loadDriverPool();

});

document.addEventListener("click", function (event) {

    const removeRouteButton =
        event.target.closest(".remove-route-button");

    if (removeRouteButton) {
        const confirmed =
            window.confirm("¿Retirar este conductor de la ruta actual?");

        if (!confirmed) {
            return;
        }

        const tripId =
            removeRouteButton.dataset.tripId;

        supabaseClient
            .rpc("finalizar_viaje", {
                p_viaje_id: tripId
            })
            .then(async function (response) {
                if (response.error) {
                    const message = response.error.message ||
                        "No fue posible finalizar el viaje.";
                    alert(`No fue posible finalizar el viaje: ${message}`);
                    return;
                }

                await loadDriverPool();
            });

        return;
    }

    const profileButton =
        event.target.closest(".profile-button");

    if (profileButton) {
        openDriverProfile(profileButton.dataset.conductorId);
        return;
    }

    const button =
        event.target.closest(".assignment-button");

    if (button && !button.disabled) {
        const conductor =
            currentConductors.find(function (item) {
                return item.id === button.dataset.conductorId;
            });

        if (conductor) {
            openAssignment(conductor);
        }
    }

    if (event.target === assignmentModal) {
        closeAssignment();
    }
});

document
    .getElementById("closeAssignment")
    .addEventListener("click", closeAssignment);

closeDriverProfileButton
    .addEventListener("click", function () {
        driverProfileModal.hidden = true;
    });

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeAssignment();
        driverProfileModal.hidden = true;
    }
});

initializeOperatorSession()
    .then(function (authenticated) {
        if (!authenticated) {
            return;
        }

        return loadDriverPool();
    })
    .then(function () {
        setConnectionStatus(true);
    })
    .catch(function (error) {
        console.error("FLEETOPS DRIVER POOL ERROR:", error);
        setConnectionStatus(false);
        renderEmpty(
            "ERROR AL CARGAR CONDUCTORES",
            "No fue posible obtener los datos desde Supabase."
        );
    });
