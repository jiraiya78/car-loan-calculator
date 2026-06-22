// Global Chart Tracker
let lossChartInstance = null;

// Helper Function: Format numbers with thousands commas
function formatMYR(num) {
  return (
    "RM " +
    num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Tab Switching System
function switchTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((el) => el.classList.remove("active"));

  if (tabName === "analysis") {
    document.getElementById("analysis-tab").classList.add("active");
    document
      .querySelector("button[onclick*='analysis']")
      .classList.add("active");
    calculateAll();
  } else {
    document.getElementById("target-tab").classList.add("active");
    document.querySelector("button[onclick*='target']").classList.add("active");
    calculateTarget();
  }
}

// Dynamically generate early selling choices limited by maximum tenure length
function updateSellEarlyOptions() {
  const totalTermMonths =
    parseInt(document.getElementById("loan-term").value) || 84;
  const maxYears = totalTermMonths / 12;
  const sellEarlySelect = document.getElementById("sell-early");
  if (!sellEarlySelect) return;

  const currentSelection = sellEarlySelect.value || "no";
  sellEarlySelect.innerHTML =
    '<option value="no">No, keep until loan ends</option>';

  for (let y = 2; y <= 9; y++) {
    if (y < maxYears) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.innerText = `Yes, sell after ${y} Years`;
      sellEarlySelect.appendChild(opt);
    }
  }

  if (parseInt(currentSelection) < maxYears) {
    sellEarlySelect.value = currentSelection;
  } else {
    sellEarlySelect.value = "no";
  }
}

// BANK NEGARA COMPLIANT CAR LOAN INSTALMENT CALCULATOR
function getMonthlyInstalment(principal, annualRatePct, months) {
  const flatAnnualInterest = principal * (annualRatePct / 100);
  const totalInterestOverTenure = flatAnnualInterest * (months / 12);
  return (principal + totalInterestOverTenure) / months;
}

// Function to handle showing/hiding used car options and dynamic logic labels
function handleConditionChange() {
  const condition = document.getElementById("car-condition").value;
  const usedOptionsWrapper = document.getElementById("used-options-wrapper");
  const usedCarNotes = document.getElementById("used-car-notes");
  const priceInputLabel = document.getElementById("price-input-label");

  if (condition === "used") {
    if (usedOptionsWrapper) usedOptionsWrapper.style.display = "block";
    if (usedCarNotes) usedCarNotes.style.display = "block";
    if (priceInputLabel)
      priceInputLabel.innerText = "Used Car Purchase Price (RM)";

    // Sync the main price slider to the value chosen in the used selection matrix
    const usedPriceValue = document.getElementById("used-list-price").value;
    document.getElementById("car-price").value = usedPriceValue;
  } else {
    if (usedOptionsWrapper) usedOptionsWrapper.style.display = "none";
    if (usedCarNotes) usedCarNotes.style.display = "none";
    if (priceInputLabel) priceInputLabel.innerText = "Car Price (RM)";
  }
  calculateAll();
}

// Main Calculation Flow
function calculateAll() {
  const condition = document.getElementById("car-condition").value;
  let carPrice = parseFloat(document.getElementById("car-price").value) || 0;
  const downPayment =
    parseFloat(document.getElementById("down-payment").value) || 0;
  const rateInput =
    parseFloat(document.getElementById("interest-rate").value) || 0;
  const totalTermMonths =
    parseInt(document.getElementById("loan-term").value) || 84;
  const sellEarlyOpt = document.getElementById("sell-early").value;
  const loanRuleType = document.getElementById("loan-rule").value;

  // Overrides price parameter bindings if structural state points to an aged premium model selection
  if (condition === "used") {
    carPrice =
      parseFloat(document.getElementById("used-list-price").value) || 60000;
    document.getElementById("car-price").value = carPrice;
  }

  const principal = carPrice - downPayment;

  if (principal <= 0 || carPrice <= 0) {
    document.getElementById("res-monthly").innerText = "RM 0.00";
    document.getElementById("res-total-paid").innerText = "RM 0.00";
    document.getElementById("res-car-value").innerText = "RM 0.00";
    document.getElementById("res-total-loss").innerText = "RM 0.00";
    return;
  }

  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
  );
  const baselineTotalInterest =
    principal * (rateInput / 100) * (totalTermMonths / 12);

  const isEarlySale = sellEarlyOpt !== "no";
  const analysisYears = isEarlySale
    ? parseInt(sellEarlyOpt)
    : totalTermMonths / 12;
  const analysisMonths = analysisYears * 12;

  document.getElementById("label-total-paid").innerText = isEarlySale
    ? `Total Paid up to Year ${analysisYears}`
    : "Total Paid over Tenure";
  document.getElementById("label-car-value").innerText =
    `Car Value at Year ${analysisYears}`;

  // Compute Early Settlement Rebates fairly based on statutory guidelines
  let evaluationTotalOutflow = 0;
  if (isEarlySale) {
    let remainingLoanBalance = 0;
    const remainingInstallments = totalTermMonths - analysisMonths;

    if (loanRuleType === "old") {
      const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
      const sumRemaining =
        (remainingInstallments * (remainingInstallments + 1)) / 2;
      const interestRebate = (sumRemaining / sumTotal) * baselineTotalInterest;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments - interestRebate;
    } else {
      const averageInterestPerMonth = baselineTotalInterest / totalTermMonths;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments -
        averageInterestPerMonth * remainingInstallments * 0.15;
    }
    evaluationTotalOutflow =
      downPayment +
      monthlyPayment * analysisMonths +
      Math.max(0, remainingLoanBalance);
  } else {
    evaluationTotalOutflow = downPayment + monthlyPayment * totalTermMonths;
  }

  // Dynamic Depreciation & Reverse-Engineered Original New Price Logic
  let finalCarValue = 0;
  let originalNewPrice = carPrice;

  if (condition === "used") {
    const carAge = parseInt(document.getElementById("car-age").value) || 5;

    // Reverse calculation steps mapping back original market entry thresholds
    if (carAge === 2) {
      originalNewPrice = carPrice / (0.8 * 0.88);
    } else if (carAge <= 5) {
      originalNewPrice = carPrice / (0.8 * Math.pow(0.88, carAge - 1));
    } else {
      originalNewPrice =
        carPrice / (0.8 * Math.pow(0.88, 4) * Math.pow(0.93, carAge - 5));
    }

    // Display context blocks highlighting the original segments value metrics
    const noteContainer = document.getElementById("used-car-notes");
    if (noteContainer) {
      noteContainer.innerHTML = `
                <div style="background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; padding: 12px; margin-top: 10px; border-radius: 4px;">
                    <span style="color: #38bdf8; font-weight: bold;">💡 Smart Buyer Insight:</span><br>
                    This <strong>${carAge}-year-old</strong> vehicle valued at <strong>${formatMYR(carPrice)}</strong> had an estimated original showroom price of <strong>${formatMYR(originalNewPrice)}</strong> when brand new.<br>
                    <small style="color: #94a3b8; display: block; margin-top: 4px;">Instead of buying a smaller, brand-new entry-level vehicle, you are securing a premium segment car that has already shed its heaviest depreciation cycle.</small>
                </div>
            `;
    }

    // Forward depreciation from the current point of purchase forward
    finalCarValue = carPrice * Math.pow(1 - 0.08, analysisYears);
  } else {
    finalCarValue = carPrice * Math.pow(1 - 0.09, analysisYears);
  }

  const absoluteLoss = evaluationTotalOutflow - finalCarValue;

  // Render Metrics Interface Screen Cards
  document.getElementById("res-monthly").innerText = formatMYR(monthlyPayment);
  document.getElementById("res-total-paid").innerText = formatMYR(
    evaluationTotalOutflow,
  );
  document.getElementById("res-car-value").innerText = formatMYR(finalCarValue);

  document.getElementById("res-total-loss").innerHTML = `
        <div style="font-size: 24px; margin-bottom: 5px;">${formatMYR(absoluteLoss)}</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(absoluteLoss / analysisYears)} / year</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(absoluteLoss / analysisMonths)} / month</div>
    `;

  const chartPoints = calculateYearlyDataPoints(
    carPrice,
    downPayment,
    rateInput,
    totalTermMonths,
    loanRuleType,
    condition,
  );
  renderLineChart(chartPoints);
}

// Compute coordinated path vectors for visual graph models
function calculateYearlyDataPoints(
  carPrice,
  downPayment,
  rateInput,
  totalTermMonths,
  loanRuleType,
  condition,
) {
  const maxYears = totalTermMonths / 12;
  const principal = carPrice - downPayment;
  let data = { labels: [], payments: [], values: [] };

  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
  );
  const baselineTotalInterest =
    principal * (rateInput / 100) * (totalTermMonths / 12);

  data.labels.push("Year 0");
  data.payments.push(downPayment);
  data.values.push(carPrice);

  for (let y = 1; y <= maxYears; y++) {
    data.labels.push(`Year ${y}`);
    const currentMonths = y * 12;
    let evaluationTotalOutflow = 0;

    if (y < maxYears) {
      let remainingLoanBalance = 0;
      const remainingInstallments = totalTermMonths - currentMonths;

      if (loanRuleType === "old") {
        const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
        const sumRemaining =
          (remainingInstallments * (remainingInstallments + 1)) / 2;
        const interestRebate =
          (sumRemaining / sumTotal) * baselineTotalInterest;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments - interestRebate;
      } else {
        const averageInterestPerMonth = baselineTotalInterest / totalTermMonths;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments -
          averageInterestPerMonth * remainingInstallments * 0.15;
      }
      evaluationTotalOutflow =
        downPayment +
        monthlyPayment * currentMonths +
        Math.max(0, remainingLoanBalance);
    } else {
      evaluationTotalOutflow = downPayment + monthlyPayment * totalTermMonths;
    }

    let currentCarValue = 0;
    if (condition === "used") {
      currentCarValue = carPrice * Math.pow(1 - 0.08, y);
    } else {
      currentCarValue = carPrice * Math.pow(1 - 0.09, y);
    }

    data.payments.push(evaluationTotalOutflow);
    data.values.push(currentCarValue);
  }
  return data;
}

function renderLineChart(chartPoints) {
  const canvasElement = document.getElementById("lossLineChart");
  if (!canvasElement) return;

  const ctx = canvasElement.getContext("2d");
  if (lossChartInstance !== null) {
    lossChartInstance.destroy();
  }

  lossChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartPoints.labels,
      datasets: [
        {
          label: "Total Expenses Incurred",
          data: chartPoints.payments,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          tension: 0.2,
          fill: true,
        },
        {
          label: "Car Resale Value Trend",
          data: chartPoints.values,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.dataset.label + ": " + formatMYR(context.parsed.y);
            },
          },
        },
      },
      scales: {
        x: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
        y: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
      },
    },
  });
}

function calculateTarget() {
  const targetMonthly =
    parseFloat(document.getElementById("target-monthly").value) || 0;
  const maxRate = parseFloat(document.getElementById("target-rate").value) || 0;
  const tableBody = document.getElementById("target-table-body");

  if (!tableBody) return;
  tableBody.innerHTML = "";
  if (targetMonthly <= 0) return;

  const terms = [48, 60, 72, 84, 96, 108];

  terms.forEach((months) => {
    const totalPrincipalInstallments = targetMonthly * months;
    const totalInterestFactor = 1 + (maxRate / 100) * (months / 12);
    const maxPrincipal = totalPrincipalInstallments / totalInterestFactor;

    const maxCarPrice = maxPrincipal / 0.9;
    const totalInterest = targetMonthly * months - maxPrincipal;

    const row = document.createElement("tr");
    row.innerHTML = `
            <td><strong>${months / 12} Years</strong> (${months} mos)</td>
            <td class="text-green">${formatMYR(maxCarPrice)}</td>
            <td class="text-red">${formatMYR(totalInterest)}</td>
        `;
    tableBody.appendChild(row);
  });
}

// Event bindings layout targeting new elements
document.addEventListener("DOMContentLoaded", function () {
  const carConditionDropdown = document.getElementById("car-condition");
  if (carConditionDropdown) {
    carConditionDropdown.addEventListener("change", handleConditionChange);
  }

  const usedPriceSelect = document.getElementById("used-list-price");
  const usedAgeSelect = document.getElementById("car-age");
  if (usedPriceSelect) usedPriceSelect.addEventListener("change", calculateAll);
  if (usedAgeSelect) usedAgeSelect.addEventListener("change", calculateAll);

  const inputIds = [
    "car-price",
    "down-payment",
    "interest-rate",
    "loan-term",
    "sell-early",
    "loan-rule",
  ];
  inputIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", calculateAll);
      element.addEventListener("input", calculateAll);
    }
  });

  const loanTermInput = document.getElementById("loan-term");
  if (loanTermInput) {
    loanTermInput.addEventListener("change", updateSellEarlyOptions);
  }

  const targetInput = document.getElementById("target-monthly");
  const targetRateInput = document.getElementById("target-rate");
  if (targetInput) targetInput.addEventListener("input", calculateTarget);
  if (targetRateInput)
    targetRateInput.addEventListener("input", calculateTarget);

  // Initial load system configuration setup
  handleConditionChange();
  updateSellEarlyOptions();
  calculateAll();
});
