// Controls come from the brush registry; ranges and brush-specific options live in the right column.
function updateSlider(wrap, control, value) {
  const input = wrap.querySelector("input");
  input.value = value;
  input.setAttribute(
    "aria-valuetext",
    `${Number(input.value).toFixed(2)} times`,
  );
  wrap.querySelector("output").value = `${Number(input.value).toFixed(2)}×`;
}

function makeSlider(control, value, change) {
  const wrap = document.createElement("div");
  wrap.className = "slider-control";
  wrap.dataset.control = control.id;
  const input = document.createElement("input");
  input.type = "range";
  input.className = "line-slider";
  input.id = `setting-${control.id}`;
  input.setAttribute("aria-label", control.label);
  input.title = `${control.label}: slide left or right. Arrow keys adjust one step.${control.note ? ` ${control.note}` : ""}`;
  for (const attr of ["min", "max", "step"]) input[attr] = control[attr];
  const caption = document.createElement("div");
  caption.className = "slider-caption";
  const label = document.createElement("label");
  label.htmlFor = input.id;
  label.className = "slider-label";
  label.textContent =
    control.caption ??
    (control.id === "density"
      ? "Density"
      : control.id === "size"
        ? "Size"
        : control.label);
  const output = document.createElement("output");
  output.htmlFor = input.id;
  output.className = "slider-value";
  caption.append(label, output);
  wrap.append(caption, input);
  updateSlider(wrap, control, value);
  input.addEventListener("input", () => {
    updateSlider(wrap, control, input.value);
    if (!control.commit) change(control.id, Number(input.value));
  });
  if (control.commit)
    input.addEventListener("change", () =>
      change(control.id, Number(input.value)),
    );
  return wrap;
}

export function renderControls(
  container,
  registration,
  settings,
  change,
  sliders,
) {
  container.replaceChildren();
  sliders.replaceChildren();
  for (const control of registration.controls) {
    if (control.type === "range") {
      sliders.append(makeSlider(control, settings[control.id], change));
      continue;
    }
    const wrap = document.createElement("div");
    wrap.className = "control";
    wrap.dataset.control = control.id;
    const label = document.createElement("label");
    label.textContent = control.label;
    label.htmlFor = `setting-${control.id}`;
    const heading = document.createElement("div");
    heading.className = "control-heading";
    heading.append(label);
    wrap.append(heading);
    if (control.type === "palette") {
      label.removeAttribute("for");
      const colors = document.createElement("div");
      colors.className = "palette";
      colors.setAttribute("role", "group");
      colors.setAttribute("aria-label", control.label);
      for (const [value, name, hex] of control.options) {
        const button = document.createElement("button");
        button.className = `color-button${hex ? "" : " mix"}`;
        if (hex) button.style.setProperty("--color", hex);
        button.title = name;
        button.dataset.value = value;
        button.setAttribute("aria-label", name);
        button.setAttribute(
          "aria-pressed",
          String(settings[control.id] === value),
        );
        button.addEventListener("click", () => change(control.id, value));
        colors.append(button);
      }
      const value = document.createElement("p");
      value.className = "palette-value";
      value.textContent = control.options.find(
        (option) => option[0] === settings[control.id],
      )?.[1];
      wrap.append(colors, value);
    } else if (control.type === "select") {
      const select = document.createElement("select");
      select.className = "select-control";
      select.id = label.htmlFor;
      for (const [value, name] of control.options)
        select.add(new Option(name, value));
      select.value = settings[control.id];
      select.addEventListener("change", () => change(control.id, select.value));
      wrap.append(select);
    } else if (control.type === "toggle") {
      heading.remove();
      label.className = "toggle-row";
      const input = document.createElement("input");
      input.id = label.htmlFor;
      input.type = "checkbox";
      input.checked = settings[control.id];
      input.addEventListener("change", () => change(control.id, input.checked));
      label.append(input);
      wrap.append(label);
    }
    container.append(wrap);
  }
}

export function syncControls(container, registration, settings, sliders) {
  for (const control of registration.controls) {
    const wrap = (control.type === "range" ? sliders : container).querySelector(
      `[data-control="${control.id}"]`,
    );
    if (!wrap) continue;
    const value = settings[control.id];
    if (control.type === "range") {
      updateSlider(wrap, control, value);
    } else if (control.type === "palette") {
      for (const button of wrap.querySelectorAll("button"))
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.value === value),
        );
      wrap.querySelector(".palette-value").textContent = control.options.find(
        (option) => option[0] === value,
      )?.[1];
    } else if (control.type === "select")
      wrap.querySelector("select").value = value;
    else if (control.type === "toggle")
      wrap.querySelector("input").checked = value;
  }
}
