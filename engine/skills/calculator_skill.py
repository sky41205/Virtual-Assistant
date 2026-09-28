import re
import ast
import operator
import math
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult

SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

SAFE_FUNCTIONS = {
    'sqrt': math.sqrt,
    'sin': math.sin,
    'cos': math.cos,
    'tan': math.tan,
    'log': math.log10,
    'ln': math.log,
    'abs': abs,
    'round': round,
    'pi': math.pi,
    'e': math.e,
}

def safe_eval(expr: str) -> float:
    """Evaluate a mathematical expression safely using AST parsing."""
    cleaned = expr.replace('^', '**').replace('×', '*').replace('÷', '/')
    node = ast.parse(cleaned, mode='eval')

    def _eval(node):
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        elif isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.BinOp):
            left = _eval(node.left)
            right = _eval(node.right)
            op_type = type(node.op)
            if op_type in SAFE_OPERATORS:
                return SAFE_OPERATORS[op_type](left, right)
            raise ValueError(f"Unsupported operator: {op_type}")
        elif isinstance(node, ast.UnaryOp):
            operand = _eval(node.operand)
            op_type = type(node.op)
            if op_type in SAFE_OPERATORS:
                return SAFE_OPERATORS[op_type](operand)
            raise ValueError(f"Unsupported operator: {op_type}")
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in SAFE_FUNCTIONS:
                args = [_eval(arg) for arg in node.args]
                return SAFE_FUNCTIONS[node.func.id](*args)
            raise ValueError("Unsupported function call")
        elif isinstance(node, ast.Name) and node.id in SAFE_FUNCTIONS:
            return SAFE_FUNCTIONS[node.id]
        else:
            raise ValueError(f"Unsafe or unsupported AST node: {type(node)}")

    return _eval(node)


class CalculatorSkill(BaseSkill):
    name = "calculator_skill"
    description = "Performs safe arithmetic, unit conversions, and structured mathematical calculations."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        keywords = [
            "calculate", "what is", "solve", "convert", "how much is", "plus",
            "minus", "multiplied by", "divided by", "square root of", "percent of",
            "percentage of", "tip on"
        ]
        if any(k in q for k in ["convert", "calculate", "solve"]):
            return True
        if any(w in q for w in ["km to miles", "miles to km", "celsius to fahrenheit", "fahrenheit to celsius", "kg to lbs", "pounds to kg"]):
            return True
        # Match math operators or equations
        if re.search(r'\d+\s*[\+\-\*\/\^%]\s*\d+', q):
            return True
        if re.search(r'\b\d+(?:\.\d+)?\s*(?:percent|%)\s+of\s+\d+', q):
            return True
        return False

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # 1. Percentage / Tip
        pct_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+(\d+(?:\.\d+)?)', q)
        if pct_match:
            p = float(pct_match.group(1))
            total = float(pct_match.group(2))
            ans = (p / 100.0) * total
            ans_str = f"{ans:.2f}".rstrip('0').rstrip('.')
            return SkillResult(
                handled=True,
                spoken_response=f"{p}% of {total} is {ans_str}.",
                display_text=f"{p}% of {total} = {ans_str}",
                card_type="calculator",
                card_data={"operation": "percentage", "rate": p, "total": total, "result": ans}
            )

        # 2. Unit Conversions
        conv_res = self._handle_conversions(q)
        if conv_res:
            return conv_res

        # 3. Arithmetic / Math Expressions
        expr_target = q
        for prefix in ["what is", "calculate", "solve", "how much is", "evaluate", "please"]:
            expr_target = re.sub(rf'\b{prefix}\b', '', expr_target)
        expr_target = expr_target.replace('plus', '+').replace('minus', '-')
        expr_target = expr_target.replace('multiplied by', '*').replace('times', '*')
        expr_target = expr_target.replace('divided by', '/').replace('over', '/')
        expr_target = re.sub(r'square root of\s*(\d+(?:\.\d+)?)', r'sqrt(\1)', expr_target)
        expr_target = re.sub(r'[^\d\.\+\-\*\/\^\(\)\%\s_a-zA-Z]', '', expr_target).strip()

        try:
            val = safe_eval(expr_target)
            val_str = f"{val:.4f}".rstrip('0').rstrip('.') if isinstance(val, float) else str(val)
            return SkillResult(
                handled=True,
                spoken_response=f"The answer is {val_str}.",
                display_text=f"{expr_target} = {val_str}",
                card_type="calculator",
                card_data={"expression": expr_target, "result": val_str}
            )
        except Exception as e:
            print(f"Calculator evaluation notice: {e}")
            return SkillResult(
                handled=False,
                spoken_response="I couldn't calculate that mathematical expression."
            )

    def _handle_conversions(self, q: str) -> Optional[SkillResult]:
        # Length
        m_len = re.search(r'(\d+(?:\.\d+)?)\s*(km|kilometers?|miles?|meters?|feet|foot|inches?|cm|centimeters?)\s+(?:in|to|into)\s+(km|kilometers?|miles?|meters?|feet|foot|inches?|cm|centimeters?)', q)
        if m_len:
            val = float(m_len.group(1))
            from_u = m_len.group(2).lower()
            to_u = m_len.group(3).lower()
            res = self._convert_length(val, from_u, to_u)
            if res is not None:
                res_str = f"{res:.3f}".rstrip('0').rstrip('.')
                return SkillResult(
                    handled=True,
                    spoken_response=f"{val} {from_u} is equal to {res_str} {to_u}.",
                    display_text=f"{val} {from_u} = {res_str} {to_u}",
                    card_type="conversion",
                    card_data={"from_val": val, "from_unit": from_u, "to_unit": to_u, "result": res_str}
                )

        # Temperature
        m_temp = re.search(r'(\d+(?:\.\d+)?)\s*(?:degrees?\s*)?(celsius|fahrenheit|kelvin|c|f|k)\s+(?:in|to|into)\s+(?:degrees?\s*)?(celsius|fahrenheit|kelvin|c|f|k)', q)
        if m_temp:
            val = float(m_temp.group(1))
            from_u = m_temp.group(2).lower()
            to_u = m_temp.group(3).lower()
            res = self._convert_temp(val, from_u, to_u)
            if res is not None:
                res_str = f"{res:.2f}".rstrip('0').rstrip('.')
                return SkillResult(
                    handled=True,
                    spoken_response=f"{val} degrees {from_u} is {res_str} degrees {to_u}.",
                    display_text=f"{val}° {from_u} = {res_str}° {to_u}",
                    card_type="conversion",
                    card_data={"from_val": val, "from_unit": from_u, "to_unit": to_u, "result": res_str}
                )

        # Weight / Mass
        m_mass = re.search(r'(\d+(?:\.\d+)?)\s*(kg|kilograms?|pounds?|lbs?|grams?|ounces?|oz)\s+(?:in|to|into)\s+(kg|kilograms?|pounds?|lbs?|grams?|ounces?|oz)', q)
        if m_mass:
            val = float(m_mass.group(1))
            from_u = m_mass.group(2).lower()
            to_u = m_mass.group(3).lower()
            res = self._convert_mass(val, from_u, to_u)
            if res is not None:
                res_str = f"{res:.3f}".rstrip('0').rstrip('.')
                return SkillResult(
                    handled=True,
                    spoken_response=f"{val} {from_u} is {res_str} {to_u}.",
                    display_text=f"{val} {from_u} = {res_str} {to_u}",
                    card_type="conversion",
                    card_data={"from_val": val, "from_unit": from_u, "to_unit": to_u, "result": res_str}
                )

        return None

    def _convert_length(self, val: float, f: str, t: str) -> Optional[float]:
        to_m = {
            'kilometer': 1000.0, 'kilometers': 1000.0, 'km': 1000.0,
            'miles': 1609.34, 'mile': 1609.34,
            'meter': 1.0, 'meters': 1.0, 'm': 1.0,
            'centimeter': 0.01, 'centimeters': 0.01, 'cm': 0.01,
            'feet': 0.3048, 'foot': 0.3048, 'ft': 0.3048,
            'inches': 0.0254, 'inch': 0.0254, 'in': 0.0254
        }
        f_norm = next((k for k in sorted(to_m.keys(), key=len, reverse=True) if f == k or f.startswith(k)), None)
        t_norm = next((k for k in sorted(to_m.keys(), key=len, reverse=True) if t == k or t.startswith(k)), None)
        if f_norm and t_norm:
            meters = val * to_m[f_norm]
            return meters / to_m[t_norm]
        return None

    def _convert_temp(self, val: float, f: str, t: str) -> Optional[float]:
        # Normalize to Celsius
        if f.startswith('c'):
            c = val
        elif f.startswith('f'):
            c = (val - 32) * 5 / 9
        elif f.startswith('k'):
            c = val - 273.15
        else:
            return None

        # Convert to target
        if t.startswith('c'):
            return c
        elif t.startswith('f'):
            return (c * 9 / 5) + 32
        elif t.startswith('k'):
            return c + 273.15
        return None

    def _convert_mass(self, val: float, f: str, t: str) -> Optional[float]:
        to_kg = {
            'kilogram': 1.0, 'kilograms': 1.0, 'kg': 1.0,
            'pound': 0.453592, 'pounds': 0.453592, 'lbs': 0.453592, 'lb': 0.453592,
            'ounce': 0.0283495, 'ounces': 0.0283495, 'oz': 0.0283495,
            'gram': 0.001, 'grams': 0.001, 'g': 0.001
        }
        f_norm = next((k for k in sorted(to_kg.keys(), key=len, reverse=True) if f == k or f.startswith(k)), None)
        t_norm = next((k for k in sorted(to_kg.keys(), key=len, reverse=True) if t == k or t.startswith(k)), None)
        if f_norm and t_norm:
            kg = val * to_kg[f_norm]
            return kg / to_kg[t_norm]
        return None
