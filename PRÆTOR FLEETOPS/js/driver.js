// =====================================================
// PRÆTOR FleetOps · Driver Onboarding
// =====================================================

// =====================================================
// ELEMENTOS
// =====================================================

const driverForm =
    document.getElementById("driverForm");

const successScreen =
    document.getElementById("successScreen");

const recoverDriverButton =
    document.getElementById("recoverDriverButton");

const onboardingSteps =
    [...document.querySelectorAll(".onboarding-step")];

let currentStep = 1;


if (!driverForm) {

    console.error(
        "driver.js: #driverForm no encontrado."
    );

    throw new Error(
        "FleetOps Driver: formulario no encontrado."
    );

}

function showStep(stepNumber) {

    currentStep = stepNumber;

    onboardingSteps.forEach(function (step) {
        const isActive =
            Number(step.dataset.step) === stepNumber;

        step.hidden = !isActive;
        step.classList.toggle("active", isActive);
    });

    document.querySelectorAll("[data-step-indicator]").forEach(function (indicator) {
        indicator.classList.toggle(
            "active",
            Number(indicator.dataset.stepIndicator) === stepNumber
        );
    });

}

function validateCurrentStep() {

    const currentSection =
        driverForm.querySelector(`[data-step="${currentStep}"]`);

    if (!currentSection) {
        return true;
    }

    const requiredFields =
        [...currentSection.querySelectorAll("[required]")];

    return requiredFields.every(function (field) {
        if (!field.value.trim()) {
            field.reportValidity();
            return false;
        }

        return true;
    });

}

document.querySelectorAll(".next-step").forEach(function (button) {
    button.addEventListener("click", function () {
        if (validateCurrentStep() && currentStep < onboardingSteps.length) {
            showStep(currentStep + 1);
        }
    });
});

document.querySelectorAll(".back-step").forEach(function (button) {
    button.addEventListener("click", function () {
        if (currentStep > 1) {
            showStep(currentStep - 1);
        }
    });
});

const cameraPanel =
    document.getElementById("cameraPanel");

const cameraSelect =
    document.getElementById("cameraSelect");

const cameraPreview =
    document.getElementById("cameraPreview");

const cameraCanvas =
    document.getElementById("cameraCanvas");

const takePhotoButton =
    document.getElementById("takePhoto");

const closeCameraButton =
    document.getElementById("closeCamera");

let cameraStream = null;
let activeCameraSide = null;

const capturedPhotos = {
    frente: null,
    reverso: null,
    selfie: null
};

async function loadCameraDevices() {

    const devices =
        await navigator.mediaDevices.enumerateDevices();

    const cameras =
        devices.filter(function (device) {
            return device.kind === "videoinput";
        });

    cameraSelect.innerHTML = cameras.map(function (camera, index) {
        return `<option value="${camera.deviceId}">${camera.label || `Cámara ${index + 1}`}</option>`;
    }).join("");

    return cameras;

}

async function openCamera(side) {

    if (!navigator.mediaDevices?.getUserMedia) {
        alert("La cámara no está disponible en este navegador.");
        return;
    }

    activeCameraSide = side;
    cameraPanel.hidden = false;

    if (cameraStream) {
        cameraStream.getTracks().forEach(function (track) {
            track.stop();
        });
    }

    cameraStream =
        await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: cameraSelect.value
                    ? { exact: cameraSelect.value }
                    : undefined,
                facingMode: "environment"
            },
            audio: false
        });

    cameraPreview.srcObject = cameraStream;
    cameraPreview.classList.add("active");

    await loadCameraDevices();

}

function closeCamera() {

    if (cameraStream) {
        cameraStream.getTracks().forEach(function (track) {
            track.stop();
        });
        cameraStream = null;
    }

    cameraPreview.srcObject = null;
    cameraPreview.classList.remove("active");
    cameraPanel.hidden = true;
    activeCameraSide = null;

}

document.querySelectorAll(".start-camera").forEach(function (button) {
    button.addEventListener("click", async function () {
        const capture =
            this.closest("[data-camera-side]");

        try {
            await openCamera(capture.dataset.cameraSide);
        }
        catch (error) {
            console.error("DRIVER CAMERA ERROR:", error);
            closeCamera();
            alert("No fue posible abrir la cámara.");
        }
    });
});

cameraSelect.addEventListener("change", async function () {
    if (activeCameraSide) {
        try {
            await openCamera(activeCameraSide);
        }
        catch (error) {
            console.error("DRIVER CAMERA SWITCH ERROR:", error);
        }
    }
});

takePhotoButton.addEventListener("click", function () {

    if (!cameraStream || !activeCameraSide) {
        return;
    }

    cameraCanvas.width = cameraPreview.videoWidth;
    cameraCanvas.height = cameraPreview.videoHeight;
    cameraCanvas.getContext("2d").drawImage(
        cameraPreview,
        0,
        0,
        cameraCanvas.width,
        cameraCanvas.height
    );

    const sideContainer =
        document.querySelector(`[data-camera-side="${activeCameraSide}"]`);

    const preview =
        sideContainer.querySelector(".photo-preview");

    const photoDataUrl =
        cameraCanvas.toDataURL("image/jpeg", 0.9);

    preview.src = photoDataUrl;
    preview.classList.add("active");

    cameraCanvas.toBlob(function (blob) {
        if (!blob) {
            alert("No fue posible procesar la fotografía.");
            return;
        }

        capturedPhotos[activeCameraSide] = blob;

        closeCamera();
    }, "image/jpeg", 0.9);

});

closeCameraButton.addEventListener("click", closeCamera);


// =====================================================
// NORMALIZADORES
// =====================================================

function normalizePlate(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizePhone(value) {

    return String(value || "")
        .replace(/[^\d]/g, "");

}

function normalizeRut(value) {

    return String(value || "")
        .replace(/[^0-9kK]/g, "")
        .toUpperCase();

}

async function findExistingDriver(rut, telefono) {

    const filters = [];

    if (rut) {
        filters.push(`rut.eq.${rut}`);
    }

    if (telefono) {
        filters.push(`telefono.eq.${telefono}`);
    }

    if (!filters.length) {
        return null;
    }

    const {
        data,
        error
    } =
        await supabaseClient
            .from("conductores")
            .select("id, driver_id, nombre, tracto_id, rut, telefono")
            .or(filters.join(","))
            .limit(10);

    if (error) {
        throw new Error(
            "Búsqueda: " +
            error.message
        );
    }

    if (!data || data.length === 0) {
        return null;
    }

    if (data.length > 1) {
        const ids = new Set(
            data.map(function (driver) {
                return driver.id;
            })
        );

        if (ids.size > 1) {
            throw new Error(
                "El RUT y/o teléfono están asociados a identidades diferentes."
            );
        }
    }

    return data[0];
}
if (recoverDriverButton) {
    recoverDriverButton.addEventListener("click", async function () {

        const rut =
            normalizeRut(
                driverForm.elements["rut"].value
            );

        if (!rut) {
            driverForm.elements["rut"].reportValidity();
            return;
        }

        recoverDriverButton.disabled = true;
        recoverDriverButton.innerText = "BUSCANDO PERFIL...";

        try {
            const existing =
                await findExistingDriver(rut, "");

            if (!existing) {
                throw new Error("No existe un perfil asociado a ese RUT.");
            }

            showSuccess(
                existing.driver_id,
                existing.nombre,
                true
            );
        }
        catch (error) {
            alert(error.message);
            recoverDriverButton.disabled = false;
            recoverDriverButton.innerText = "YA TENGO PERFIL · RECUPERAR";
        }

    });
}


async function uploadDocument(file, storagePath) {
  if (!file) {
    throw new Error("Archivo requerido.");
  }

  const { error } = await supabaseClient.storage
    .from("fleetops-documents")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true
    });

  if (error) {
    throw new Error(
      `No se pudo subir ${file.name}: ${error.message}`
    );
  }

  return storagePath;
}

async function updateConductorIdentity({
  conductorId,
  nombre,
  telefono,
  ciudad,
  tipoLicencia,
  patenteHabitual,
  licencia,
  licenciaVencimiento,
  tractoId
}) {
  const { error } = await supabaseClient
    .from("conductores")
    .update({
      nombre: nombre || null,
      telefono: telefono || null,
      ciudad: ciudad || null,
      tipo_licencia: tipoLicencia || null,
      patente_habitual: patenteHabitual || null,
      licencia: licencia || null,
      licencia_vencimiento: licenciaVencimiento || null,
      tracto_id: tractoId || null
    })
    .eq("id", conductorId);

  if (error) {
    throw new Error(
      `No se pudo actualizar la identidad del conductor: ${error.message}`
    );
  }
}

async function getOrCreateTractoByPatente(patente) {
  const normalizedPatente = normalizePlate(patente);

  if (!normalizedPatente) {
    throw new Error("La patente del equipo es obligatoria.");
  }

  const { data: existing, error: findError } = await supabaseClient
    .from("tractos")
    .select("id, patente, estado")
    .eq("patente", normalizedPatente)
    .maybeSingle();

  if (findError) {
    throw new Error(
      `No se pudo consultar el equipo ${normalizedPatente}: ${findError.message}`
    );
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabaseClient
    .from("tractos")
    .insert([{
      patente: normalizedPatente,
      estado: "Disponible"
    }])
    .select("id, patente, estado")
    .single();

  if (createError) {
    throw new Error(
      `No se pudo registrar el equipo ${normalizedPatente}: ${createError.message}`
    );
  }

  return created;
}

async function registerConductorDocument({
  conductorId,
  tipoDocumento,
  storagePath,
  file
}) {
  const { error: deleteError } = await supabaseClient
    .from("conductor_documentos")
    .delete()
    .eq("conductor_id", conductorId)
    .eq("tipo_documento", tipoDocumento);

  if (deleteError) {
    throw new Error(
      `No se pudo reemplazar el documento ${tipoDocumento}: ${deleteError.message}`
    );
  }

  const { error } = await supabaseClient
    .from("conductor_documentos")
    .insert([{
      conductor_id: conductorId,
      tipo_documento: tipoDocumento,
      storage_path: storagePath,
      nombre_archivo: file?.name || null,
      mime_type: file?.type || null,
      tamano_bytes: file?.size || null,
      estado_revision: "Pendiente"
    }]);

  if (error) {
    throw new Error(
      `No se pudo registrar el documento ${tipoDocumento}: ${error.message}`
    );
  }
}

async function registerTractoDocument({
  tractoId,
  tipoDocumento,
  storagePath,
  file
}) {
  const { error: deleteError } = await supabaseClient
    .from("tracto_documentos")
    .delete()
    .eq("tracto_id", tractoId)
    .eq("tipo_documento", tipoDocumento);

  if (deleteError) {
    throw new Error(
      `No se pudo reemplazar el documento ${tipoDocumento}: ${deleteError.message}`
    );
  }

  const { error } = await supabaseClient
    .from("tracto_documentos")
    .insert([{
      tracto_id: tractoId,
      tipo_documento: tipoDocumento,
      storage_path: storagePath,
      nombre_archivo: file?.name || null,
      mime_type: file?.type || null,
      tamano_bytes: file?.size || null,
      estado_revision: "Pendiente"
    }]);

  if (error) {
    throw new Error(
      `No se pudo registrar el documento ${tipoDocumento}: ${error.message}`
    );
  }
}

// =====================================================
// SUBMIT
// =====================================================

driverForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const btn =
            driverForm.querySelector('[data-step="3"] .send');


        btn.disabled = true;

        btn.innerText = "REGISTRANDO...";


        try {

            const nombre =
                driverForm.elements["nombre"]
                    .value
                    .trim();


            const rut =
                normalizeRut(
                    driverForm.elements["rut"]
                        .value
                );


            const telefono =
                normalizePhone(
                    driverForm.elements["telefono"]
                        .value
                );


            const tipo_licencia =
                driverForm.elements["tipo_licencia"]
                    .value;


            const ciudad =
                driverForm.elements["ciudad"]
                    .value
                    .trim();


            const patente_habitual =
                normalizePlate(
                    driverForm.elements["patente_habitual"]
                        .value
                );


            const licencia =
                driverForm.elements["licencia"]
                    .value
                    .trim();


            const licencia_vencimiento =
                driverForm.elements["licencia_vencimiento"]
                    .value;


            const permiso_circulacion =
                driverForm.elements["permiso_circulacion"]
                    .files?.[0] || null;


            const soap =
                driverForm.elements["soap"]
                    .files?.[0] || null;


            const revision_tecnica =
                driverForm.elements["revision_tecnica"]
                    .files?.[0] || null;


            const padron =
                driverForm.elements["padron"]
                    .files?.[0] || null;


            // =========================================
            // VALIDACIÓN
            // =========================================

            if (
                !nombre ||
                !rut ||
                telefono.length < 8 ||
                !tipo_licencia ||
                !ciudad ||
                !licencia ||
                !licencia_vencimiento ||
                !patente_habitual ||
                !permiso_circulacion ||
                !soap ||
                !revision_tecnica ||
                !padron
            ) {

                throw new Error(
                    "Completa todos los campos obligatorios."
                );

            }


            // =========================================
            // BUSCAR EXISTENTE
            // =========================================

            console.log(
                "DRIVER: verificando RUT",
                rut
            );


            const existing =
                await findExistingDriver(
                    rut,
                    telefono
                );

            let conductorId = null;
            let conductorDriverId = null;
            let conductorNombre = nombre;
            let conductorExistente = false;


            if (existing) {

                console.log(
                    "DRIVER: reutilizando identidad →",
                    existing.driver_id
                );

                conductorId = existing.id;
                conductorDriverId = existing.driver_id;
                conductorNombre = existing.nombre;
                conductorExistente = true;

            } else {

                // =========================================
                // CREAR NUEVO
                // =========================================

                console.log(
                    "DRIVER: creando nuevo"
                );


                const {

                    data,

                    error

                } =
                    await supabaseClient

                        .from("conductores")

                        .insert([

                            {

                                nombre:
                                    nombre,

                                rut:
                                    rut,

                                telefono:
                                    telefono,

                                tipo_licencia:
                                    tipo_licencia,

                                ciudad:
                                    ciudad,

                                patente_habitual:
                                    patente_habitual ||
                                    null

                            }

                        ])

                        .select("id, driver_id, nombre")

                        .single();


                if (error) {

                    throw new Error(
                        "Registro: " +
                        error.message
                    );

                }


                conductorId = data.id;
                conductorDriverId = data.driver_id;
                conductorNombre = data.nombre;

                console.log(
                    "DRIVER: creado →",
                    conductorDriverId
                );

            }


            // =========================================
            // CREAR / RECUPERAR EQUIPO
            // =========================================

            console.log(
                "DRIVER: registrando equipo →",
                patente_habitual
            );

            const tracto =
                await getOrCreateTractoByPatente(
                    patente_habitual
                );


            // =========================================
            // VINCULAR CONDUCTOR + EQUIPO + LICENCIA
            // =========================================

            await updateConductorIdentity({
                conductorId: conductorId,
                nombre,
                telefono,
                ciudad,
                tipoLicencia: tipo_licencia,
                patenteHabitual: patente_habitual,
                licencia,
                licenciaVencimiento: licencia_vencimiento,
                tractoId: tracto.id
            });


            console.log(
                "DRIVER: equipo vinculado →",
                tracto.patente
            );


            // =========================================
            // DOCUMENTACIÓN DEL EQUIPO
            // =========================================

            const equipmentDocuments = [
                {
                    tipoDocumento: "permiso_circulacion",
                    file: permiso_circulacion,
                    folder: "permiso-circulacion"
                },
                {
                    tipoDocumento: "soap",
                    file: soap,
                    folder: "soap"
                },
                {
                    tipoDocumento: "revision_tecnica",
                    file: revision_tecnica,
                    folder: "revision-tecnica"
                },
                {
                    tipoDocumento: "padron_vehicular",
                    file: padron,
                    folder: "padron"
                }
            ];


            for (const document of equipmentDocuments) {
                const extension =
                    document.file.name.includes(".")
                        ? document.file.name.split(".").pop().toLowerCase()
                        : "bin";

                const storagePath =
                    `equipment/${tracto.id}/${document.folder}/${crypto.randomUUID()}.${extension}`;

                await uploadDocument(
                    document.file,
                    storagePath
                );

                await registerTractoDocument({
                    tractoId: tracto.id,
                    tipoDocumento: document.tipoDocumento,
                    storagePath,
                    file: document.file
                });
            }


            console.log(
                "DRIVER: documentación del equipo registrada."
            );


            // =========================================
            // DOCUMENTACIÓN DEL CONDUCTOR
            // =========================================

            const driverDocuments = [
                {
                    tipoDocumento: "licencia_frente",
                    blob: capturedPhotos.frente,
                    folder: "frente"
                },
                {
                    tipoDocumento: "licencia_reverso",
                    blob: capturedPhotos.reverso,
                    folder: "reverso"
                },
                {
                    tipoDocumento: "selfie",
                    blob: capturedPhotos.selfie,
                    folder: "selfie"
                }
            ];


            for (const document of driverDocuments) {
                console.log(
                    "DRIVER DOCUMENT DEBUG:",
                    document.tipoDocumento,
                    document.blob,
                    document.blob instanceof Blob,
                    document.blob?.type,
                    document.blob?.size
                );

                const file = new File(
                    [document.blob],
                    `${document.tipoDocumento}.jpg`,
                    {
                        type: document.blob.type || "image/jpeg"
                    }
                );

                const storagePath =
                    `drivers/${conductorId}/${document.folder}/${crypto.randomUUID()}.jpg`;

                await uploadDocument(
                    file,
                    storagePath
                );

                await registerConductorDocument({
                    conductorId: conductorId,
                    tipoDocumento: document.tipoDocumento,
                    storagePath,
                    file
                });
            }


            console.log(
                "DRIVER: documentación del conductor registrada."
            );


            console.log(
                "DRIVER: creado →",
                conductorDriverId
            );


            showSuccess(
                conductorDriverId,
                conductorNombre,
                false
            );

        }


        catch (err) {

            console.error(
                "DRIVER ERROR:",
                err
            );


            alert(
                "No fue posible crear el perfil.\n\n" +
                err.message
            );


            btn.disabled = false;

            btn.innerText = "CONFIRMAR IDENTIDAD";

        }

    }
);


// =====================================================
// PANTALLA DE ÉXITO
// =====================================================

function showSuccess(
    driverId,
    nombre,
    existed
) {

    const operationLink =
        document.getElementById("operationBtn");

    try {
        localStorage.setItem(
            "fleetops.driver_id",
            driverId
        );

        localStorage.setItem(
            "fleetops.driver_name",
            nombre
        );
    }
    catch (storageError) {
        console.warn(
            "DRIVER: no fue posible guardar la identidad local",
            storageError
        );
    }

    if (operationLink) {
        operationLink.href =
            `reportes.html?driver_id=${encodeURIComponent(driverId)}`;
    }

    driverForm.style.display = "none";

    successScreen.style.display = "block";


    document.getElementById("driverIdMsg").innerText =
        existed
            ? "YA TENÍAS PERFIL · TU DRIVER ID"
            : "TU DRIVER ID FLEETOPS";


    document.getElementById("driverIdValue").innerText =
        driverId;


    document.getElementById("driverIdName").innerText =
        nombre;


    successScreen.scrollIntoView({
        behavior: "smooth"
    });

}


// =====================================================
// COPIAR ID
// =====================================================

document
    .getElementById("copyBtn")
    .addEventListener(
        "click",
        function () {

            const id =
                document.getElementById(
                    "driverIdValue"
                ).innerText;


            const btn = this;


            navigator.clipboard
                .writeText(id)
                .then(
                    () => {

                        btn.innerText =
                            "COPIADO ✓";


                        setTimeout(
                            () => {

                                btn.innerText =
                                    "COPIAR ID";

                            },
                            1500
                        );

                    }
                );

        }
    );