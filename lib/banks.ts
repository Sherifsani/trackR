export interface NigerianBank {
  name: string
  code: string  // 6-char NIBSS NIP code
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: "Access Bank",                     code: "000014" },
  { name: "Citibank Nigeria",                code: "000009" },
  { name: "Ecobank Nigeria",                 code: "000010" },
  { name: "Fidelity Bank",                   code: "000007" },
  { name: "First Bank of Nigeria",           code: "000016" },
  { name: "First City Monument Bank (FCMB)", code: "000003" },
  { name: "Guaranty Trust Bank (GTB)",       code: "000013" },
  { name: "Heritage Bank",                   code: "000020" },
  { name: "Keystone Bank",                   code: "000002" },
  { name: "Polaris Bank",                    code: "000008" },
  { name: "Stanbic IBTC Bank",              code: "000012" },
  { name: "Standard Chartered Bank",         code: "000021" },
  { name: "Sterling Bank",                   code: "000001" },
  { name: "Union Bank of Nigeria",           code: "000018" },
  { name: "United Bank for Africa (UBA)",    code: "000004" },
  { name: "Unity Bank",                      code: "000011" },
  { name: "Wema Bank",                       code: "000017" },
  { name: "Zenith Bank",                     code: "000015" },
  { name: "Kuda Bank",                       code: "090267" },
  { name: "Opay",                            code: "100004" },
  { name: "PalmPay",                         code: "100033" },
  { name: "Moniepoint Microfinance Bank",    code: "090405" },
  { name: "VFD Microfinance Bank",           code: "090110" },
  { name: "Carbon (One Finance)",            code: "100046" },
]
