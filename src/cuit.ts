// Validación de CUIT argentino real — dígito verificador módulo 11
export function validarFormatoCUIT(cuit: string): boolean {
  const limpio = cuit.replace(/[^0-9]/g, "");
  if (limpio.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = mult.reduce((acc, m, i) => acc + m * parseInt(limpio[i], 10), 0);
  const resto = suma % 11;
  const digitoEsperado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return digitoEsperado === parseInt(limpio[10], 10);
}
