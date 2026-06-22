// Helper Function: Format numbers with thousands commas and 2 decimals
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

// Convert Flat Rate to Effective Interest Rate (EIR) for accurate Reducing Balance mapping
function flatToEIR(flatRate, months) {
  if (flatRate === 0) return 0;
  const t = months / 12;
  const totalInterest = flatRate * t;
  return (2 * months * totalInterest) / (months * (1 + totalInterest) + 100);
}

// Main Calculation Flow
function calculateAll() {
  const condition = document.getElementById("car-condition").value;
  const carPrice = parseFloat(document.getElementById("car-price").value) || 0;
  const downPayment =
    parseFloat(document.getElementById("down-payment").value) || 0;
  const rateInput =
    parseFloat(document.getElementById("interest-rate").value) || 0;
  const totalTermMonths = parseInt(document.getElementById("loan-term").value);
  const sellEarlyOpt = document.getElementById("sell-early").value;

  const principal = carPrice - downPayment;
  if (principal <= 0 || carPrice <= 0) {
    document.getElementById("res-monthly").innerText = formatMYR(0);
    document.getElementById("res-total-paid").innerText = formatMYR(0);
    document.getElementById("res-car-value").innerText = formatMYR(0);
    document.getElementById("res-total-loss").innerText = formatMYR(0);
    document.getElementById("bar-value").style.width = "0%";
    document.getElementById("bar-loss").style.width = "0%";
    return;
  }

  let monthlyPayment = 0;
  let totalPaidOverTenure = 0;
  let totalInterestPaid = 0;

  // 1. Calculate Loan Structure based on Rule Type
  if (document.getElementById("loan-rule").value === "old") {
    const annualizedInterest = principal * (rateInput / 100);
    totalInterestPaid = annualizedInterest * (totalTermMonths / 12);
    totalPaidOverTenure = principal + totalInterestPaid;
    monthlyPayment = totalPaidOverTenure / totalTermMonths;
  } else {
    // NEW SYSTEM (2026 Act): Reducing balance via True Monthly Amortization
    const estimatedEIR = flatToEIR(rateInput / 100, totalTermMonths);
    const monthlyRate = estimatedEIR / 12;

    if (monthlyRate === 0) {
      monthlyPayment = principal / totalTermMonths;
    } else {
      monthlyPayment =
        (principal *
          (monthlyRate * Math.pow(1 + monthlyRate, totalTermMonths))) /
        (Math.pow(1 + monthlyRate, totalTermMonths) - 1);
    }
    totalPaidOverTenure = monthlyPayment * totalTermMonths;
    totalInterestPaid = totalPaidOverTenure - principal;
  }

  // 2. Determine Tracking Horizons (Early Sale vs Full Maturity)
  const isEarlySale = sellEarlyOpt !== "no";
  const analysisYears = isEarlySale
    ? parseInt(sellEarlyOpt)
    : totalTermMonths / 12;
  const analysisMonths = analysisYears * 12;

  // Update Display Labels dynamically
  document.getElementById("label-total-paid").innerText = isEarlySale
    ? `Total Paid up to Year ${analysisYears}`
    : "Total Paid over Tenure";
  document.getElementById("label-car-value").innerText =
    `Car Value at Year ${analysisYears}`;

  // 3. Compute Out-of-pocket tracking at specific evaluation boundary
  let evaluationTotalOutflow = 0;
  if (isEarlySale) {
    let remainingLoanBalance = 0;
    if (document.getElementById("loan-rule").value === "old") {
      const totalInstallments = totalTermMonths;
      const remainingInstallments = totalInstallments - analysisMonths;
      const sumTotal = (totalInstallments * (totalInstallments + 1)) / 2;
      const sumRemaining =
        (remainingInstallments * (remainingInstallments + 1)) / 2;
      const interestRebate = (sumRemaining / sumTotal) * totalInterestPaid;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments - interestRebate;
    } else {
      const estimatedEIR = flatToEIR(rateInput / 100, totalTermMonths);
      const monthlyRate = estimatedEIR / 12;
      remainingLoanBalance = principal;
      for (let m = 0; m < analysisMonths; m++) {
        let interestPayment = remainingLoanBalance * monthlyRate;
        let principalPayment = monthlyPayment - interestPayment;
        remainingLoanBalance -= principalPayment;
      }
    }
    evaluationTotalOutflow =
      downPayment +
      monthlyPayment * analysisMonths +
      Math.max(0, remainingLoanBalance);
  } else {
    evaluationTotalOutflow = downPayment + totalPaidOverTenure;
  }

  // 4. Depreciation Mechanics (Compound 9% annually)
  const depreciationRate = 0.09;
  let finalCarValue = carPrice * Math.pow(1 - depreciationRate, analysisYears);

  // 5. Net Financial Losses Calculation
  const absoluteLoss = evaluationTotalOutflow - finalCarValue;
  const lossPerYear = absoluteLoss / analysisYears;
  const lossPerMonth = absoluteLoss / analysisMonths;

  // 6. UI Render Updates with formatted numbers
  document.getElementById("res-monthly").innerText = formatMYR(monthlyPayment);
  document.getElementById("res-total-paid").innerText = formatMYR(
    evaluationTotalOutflow,
  );
  document.getElementById("res-car-value").innerText = formatMYR(finalCarValue);

  // Detailed multi-line display layout within our loss container element
  document.getElementById("res-total-loss").innerHTML = `
        <div style="font-size: 24px; margin-bottom: 5px;">${formatMYR(absoluteLoss)}</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(lossPerYear)} / year</div>
        <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(lossPerMonth)} / month</div>
    `;

  // 7. Graph Render Logic via CSS Percentage Segments
  const combinedTotalVal = evaluationTotalOutflow;
  const valuePercent = (finalCarValue / combinedTotalVal) * 100;
  const lossPercent = (absoluteLoss / combinedTotalVal) * 100;

  document.getElementById("bar-value").style.width = `${valuePercent}%`;
  document.getElementById("bar-loss").style.width = `${lossPercent}%`;
}

// TAB 2 Logic: Reverse calculation engine for target payments
function calculateTarget() {
  const targetMonthly =
    parseFloat(document.getElementById("target-monthly").value) || 0;
  const maxRate = parseFloat(document.getElementById("target-rate").value) || 0;
  const tableBody = document.getElementById("target-table-body");

  tableBody.innerHTML = "";
  if (targetMonthly <= 0) return;

  const terms = [48, 60, 72, 84, 96, 108]; // 4 to 9 years

  terms.forEach((months) => {
    const estimatedEIR = flatToEIR(maxRate / 100, months);
    const monthlyRate = estimatedEIR / 12;

    let maxPrincipal = 0;
    if (monthlyRate === 0) {
      maxPrincipal = targetMonthly * months;
    } else {
      maxPrincipal =
        targetMonthly /
        ((monthlyRate * Math.pow(1 + monthlyRate, months)) /
          (Math.pow(1 + monthlyRate, months) - 1));
    }

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

// Initial bootstrap activation
window.onload = function () {
  calculateAll();
};
