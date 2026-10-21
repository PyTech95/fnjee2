"""Question-bank taxonomy: Subject → Class → Chapter → Topic.

Why this exists
- Imports arrive with messy labels ("chem", "XI", "class-11", "Mole concept ", "GOC"…).
  Filters are exact matches, so one spelling difference hides a question from the
  subject/class/chapter view. Everything that writes a question runs it through
  ``normalize_tags`` so the same chapter always has the same name.
- ``SYLLABUS`` (NCERT chapters used by JEE/NEET, incl. chapters removed in the
  2023 rationalisation that older question banks still use) is the canonical list.
  It lets us fix typos, map common coaching names to the NCERT chapter, fill a
  missing class when a chapter only exists in one class, and correct a subject that
  was defaulted wrongly when the chapter clearly belongs to another subject.

Pure functions only (no DB), so they are easy to unit-test.
"""
from __future__ import annotations

import difflib
import re
from typing import Dict, List, Optional, Tuple

SUBJECTS = ("Physics", "Chemistry", "Mathematics", "Biology")
CLASSES = ("11", "12")

SYLLABUS: Dict[str, Dict[str, List[str]]] = {
    "Physics": {
        "11": [
            "Units and Measurements", "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion",
            "Work, Energy and Power", "System of Particles and Rotational Motion", "Gravitation",
            "Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties of Matter",
            "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves",
        ],
        "12": [
            "Electric Charges and Fields", "Electrostatic Potential and Capacitance", "Current Electricity",
            "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction",
            "Alternating Current", "Electromagnetic Waves", "Ray Optics and Optical Instruments", "Wave Optics",
            "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductor Electronics",
            "Communication Systems",
        ],
    },
    "Chemistry": {
        "11": [
            "Some Basic Concepts of Chemistry", "Structure of Atom",
            "Classification of Elements and Periodicity in Properties", "Chemical Bonding and Molecular Structure",
            "States of Matter", "Thermodynamics", "Equilibrium", "Redox Reactions", "Hydrogen",
            "The s-Block Elements", "The p-Block Elements",
            "Organic Chemistry - Some Basic Principles and Techniques", "Hydrocarbons", "Environmental Chemistry",
        ],
        "12": [
            "The Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry",
            "General Principles and Processes of Isolation of Elements", "The p-Block Elements",
            "The d- and f-Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes",
            "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines",
            "Biomolecules", "Polymers", "Chemistry in Everyday Life",
        ],
    },
    "Mathematics": {
        "11": [
            "Sets", "Relations and Functions", "Trigonometric Functions", "Principle of Mathematical Induction",
            "Complex Numbers and Quadratic Equations", "Linear Inequalities", "Permutations and Combinations",
            "Binomial Theorem", "Sequences and Series", "Straight Lines", "Conic Sections",
            "Introduction to Three Dimensional Geometry", "Limits and Derivatives", "Mathematical Reasoning",
            "Statistics", "Probability",
        ],
        "12": [
            "Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants",
            "Continuity and Differentiability", "Application of Derivatives", "Integrals",
            "Application of Integrals", "Differential Equations", "Vector Algebra", "Three Dimensional Geometry",
            "Linear Programming", "Probability",
        ],
    },
    "Biology": {
        "11": [
            "The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom",
            "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals",
            "Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division", "Transport in Plants",
            "Mineral Nutrition", "Photosynthesis in Higher Plants", "Respiration in Plants",
            "Plant Growth and Development", "Digestion and Absorption", "Breathing and Exchange of Gases",
            "Body Fluids and Circulation", "Excretory Products and their Elimination", "Locomotion and Movement",
            "Neural Control and Coordination", "Chemical Coordination and Integration",
        ],
        "12": [
            "Reproduction in Organisms", "Sexual Reproduction in Flowering Plants", "Human Reproduction",
            "Reproductive Health", "Principles of Inheritance and Variation", "Molecular Basis of Inheritance",
            "Evolution", "Human Health and Disease", "Strategies for Enhancement in Food Production",
            "Microbes in Human Welfare", "Biotechnology: Principles and Processes",
            "Biotechnology and its Applications", "Organisms and Populations", "Ecosystem",
            "Biodiversity and Conservation", "Environmental Issues",
        ],
    },
}

# Common coaching / textbook names → NCERT chapter. When the original name is more
# specific than the chapter (e.g. "Mole Concept"), it becomes the topic if none is set.
_CHAPTER_ALIASES: Dict[str, Dict[str, str]] = {
    "Physics": {
        "units and measurement": "Units and Measurements", "units and dimensions": "Units and Measurements",
        "unit and dimension": "Units and Measurements", "units dimensions and errors": "Units and Measurements",
        "physical world and measurement": "Units and Measurements", "measurement": "Units and Measurements",
        "kinematics 1d": "Motion in a Straight Line", "rectilinear motion": "Motion in a Straight Line",
        "projectile motion": "Motion in a Plane", "kinematics 2d": "Motion in a Plane",
        "relative motion": "Motion in a Plane", "circular motion": "Motion in a Plane",
        "newtons laws of motion": "Laws of Motion", "nlm": "Laws of Motion", "friction": "Laws of Motion",
        "work energy power": "Work, Energy and Power", "work power energy": "Work, Energy and Power",
        "work energy and power": "Work, Energy and Power", "wpe": "Work, Energy and Power",
        "rotational motion": "System of Particles and Rotational Motion",
        "rotational dynamics": "System of Particles and Rotational Motion",
        "centre of mass": "System of Particles and Rotational Motion",
        "center of mass": "System of Particles and Rotational Motion",
        "com and collisions": "System of Particles and Rotational Motion",
        "elasticity": "Mechanical Properties of Solids", "properties of solids": "Mechanical Properties of Solids",
        "fluid mechanics": "Mechanical Properties of Fluids", "fluids": "Mechanical Properties of Fluids",
        "surface tension": "Mechanical Properties of Fluids", "viscosity": "Mechanical Properties of Fluids",
        "calorimetry": "Thermal Properties of Matter", "heat transfer": "Thermal Properties of Matter",
        "thermal expansion": "Thermal Properties of Matter", "heat and thermodynamics": "Thermodynamics",
        "kinetic theory of gases": "Kinetic Theory", "ktg": "Kinetic Theory",
        "simple harmonic motion": "Oscillations", "shm": "Oscillations",
        "wave motion": "Waves", "sound waves": "Waves", "waves on a string": "Waves",
        "electrostatics": "Electric Charges and Fields", "electric field": "Electric Charges and Fields",
        "coulombs law": "Electric Charges and Fields", "gauss law": "Electric Charges and Fields",
        "electric potential": "Electrostatic Potential and Capacitance",
        "capacitance": "Electrostatic Potential and Capacitance",
        "capacitors": "Electrostatic Potential and Capacitance",
        "magnetic effects of current": "Moving Charges and Magnetism",
        "magnetic effect of current": "Moving Charges and Magnetism",
        "magnetic effects of electric current": "Moving Charges and Magnetism",
        "magnetism": "Magnetism and Matter", "emi": "Electromagnetic Induction",
        "ac": "Alternating Current", "ac circuits": "Alternating Current",
        "em waves": "Electromagnetic Waves", "ray optics": "Ray Optics and Optical Instruments",
        "geometrical optics": "Ray Optics and Optical Instruments", "optics": "Ray Optics and Optical Instruments",
        "dual nature of matter and radiation": "Dual Nature of Radiation and Matter",
        "photoelectric effect": "Dual Nature of Radiation and Matter",
        "atomic physics": "Atoms", "atoms and nuclei": "Nuclei", "nuclear physics": "Nuclei",
        "semiconductors": "Semiconductor Electronics", "semiconductor": "Semiconductor Electronics",
        "semiconductor devices": "Semiconductor Electronics", "electronic devices": "Semiconductor Electronics",
    },
    "Chemistry": {
        "mole concept": "Some Basic Concepts of Chemistry", "basic concepts of chemistry": "Some Basic Concepts of Chemistry",
        "stoichiometry": "Some Basic Concepts of Chemistry", "atomic structure": "Structure of Atom",
        "periodic table": "Classification of Elements and Periodicity in Properties",
        "periodic properties": "Classification of Elements and Periodicity in Properties",
        "periodic classification": "Classification of Elements and Periodicity in Properties",
        "classification of elements": "Classification of Elements and Periodicity in Properties",
        "chemical bonding": "Chemical Bonding and Molecular Structure",
        "gaseous state": "States of Matter", "states of matter gases and liquids": "States of Matter",
        "chemical thermodynamics": "Thermodynamics", "thermochemistry": "Thermodynamics",
        "chemical equilibrium": "Equilibrium", "ionic equilibrium": "Equilibrium",
        "redox": "Redox Reactions", "s block": "The s-Block Elements", "s block elements": "The s-Block Elements",
        "goc": "Organic Chemistry - Some Basic Principles and Techniques",
        "general organic chemistry": "Organic Chemistry - Some Basic Principles and Techniques",
        "organic chemistry basic principles": "Organic Chemistry - Some Basic Principles and Techniques",
        "iupac nomenclature": "Organic Chemistry - Some Basic Principles and Techniques",
        "isomerism": "Organic Chemistry - Some Basic Principles and Techniques",
        "solid state": "The Solid State", "solutions and colligative properties": "Solutions",
        "liquid solutions": "Solutions", "colligative properties": "Solutions",
        "kinetics": "Chemical Kinetics", "metallurgy": "General Principles and Processes of Isolation of Elements",
        "p block": "The p-Block Elements", "p block elements": "The p-Block Elements",
        "d and f block": "The d- and f-Block Elements", "d and f block elements": "The d- and f-Block Elements",
        "d block": "The d- and f-Block Elements", "transition elements": "The d- and f-Block Elements",
        "coordination chemistry": "Coordination Compounds",
        "alkyl halides": "Haloalkanes and Haloarenes", "haloalkanes": "Haloalkanes and Haloarenes",
        "alcohols phenols ethers": "Alcohols, Phenols and Ethers",
        "aldehydes and ketones": "Aldehydes, Ketones and Carboxylic Acids",
        "carbonyl compounds": "Aldehydes, Ketones and Carboxylic Acids",
        "carboxylic acids": "Aldehydes, Ketones and Carboxylic Acids",
        "amines and nitrogen compounds": "Amines", "organic compounds containing nitrogen": "Amines",
    },
    "Mathematics": {
        "functions": "Relations and Functions", "trigonometry": "Trigonometric Functions",
        "trigonometric ratios": "Trigonometric Functions", "trigonometric equations": "Trigonometric Functions",
        "mathematical induction": "Principle of Mathematical Induction",
        "complex numbers": "Complex Numbers and Quadratic Equations",
        "quadratic equations": "Complex Numbers and Quadratic Equations",
        "quadratic equation": "Complex Numbers and Quadratic Equations",
        "inequalities": "Linear Inequalities", "permutation and combination": "Permutations and Combinations",
        "p and c": "Permutations and Combinations", "binomial": "Binomial Theorem",
        "sequence and series": "Sequences and Series", "progressions": "Sequences and Series",
        "straight line": "Straight Lines", "coordinate geometry straight lines": "Straight Lines",
        "circle": "Conic Sections", "circles": "Conic Sections", "parabola": "Conic Sections",
        "ellipse": "Conic Sections", "hyperbola": "Conic Sections",
        "limits": "Limits and Derivatives", "inverse trigonometry": "Inverse Trigonometric Functions",
        "itf": "Inverse Trigonometric Functions", "continuity": "Continuity and Differentiability",
        "differentiability": "Continuity and Differentiability", "differentiation": "Continuity and Differentiability",
        "applications of derivatives": "Application of Derivatives", "aod": "Application of Derivatives",
        "maxima and minima": "Application of Derivatives",
        "integration": "Integrals", "indefinite integration": "Integrals", "definite integration": "Integrals",
        "indefinite integrals": "Integrals", "definite integrals": "Integrals",
        "area under curves": "Application of Integrals", "area under the curve": "Application of Integrals",
        "applications of integrals": "Application of Integrals",
        "vectors": "Vector Algebra", "3d geometry": "Three Dimensional Geometry",
        "three dimensional geometry 3d": "Three Dimensional Geometry", "lpp": "Linear Programming",
    },
    "Biology": {
        "cell the unit of life": "Cell: The Unit of Life", "cell": "Cell: The Unit of Life",
        "cell biology": "Cell: The Unit of Life", "cell structure": "Cell: The Unit of Life",
        "cell division": "Cell Cycle and Cell Division", "photosynthesis": "Photosynthesis in Higher Plants",
        "plant respiration": "Respiration in Plants", "digestion": "Digestion and Absorption",
        "breathing": "Breathing and Exchange of Gases", "respiration in humans": "Breathing and Exchange of Gases",
        "circulation": "Body Fluids and Circulation", "excretion": "Excretory Products and their Elimination",
        "nervous system": "Neural Control and Coordination", "endocrine system": "Chemical Coordination and Integration",
        "genetics": "Principles of Inheritance and Variation",
        "molecular genetics": "Molecular Basis of Inheritance",
        "biotechnology principles and processes": "Biotechnology: Principles and Processes",
        "biotechnology applications": "Biotechnology and its Applications",
        "ecosystems": "Ecosystem", "biodiversity": "Biodiversity and Conservation",
        "human health and diseases": "Human Health and Disease",
        "reproductive health": "Reproductive Health",
    },
}

# Aliases that name a part of the chapter (not just another name for it). When one of
# these is used as the chapter, it is kept as the topic so nothing is lost.
_TOPIC_LEVEL_ALIASES = {
    "mole concept", "stoichiometry", "friction", "projectile motion", "relative motion", "circular motion",
    "centre of mass", "center of mass", "com and collisions", "surface tension", "viscosity", "calorimetry",
    "heat transfer", "thermal expansion", "coulombs law", "gauss law", "electric field", "electric potential",
    "capacitance", "capacitors", "photoelectric effect", "sound waves", "waves on a string",
    "iupac nomenclature", "isomerism", "ionic equilibrium", "chemical equilibrium", "thermochemistry",
    "colligative properties", "aldehydes and ketones", "carboxylic acids", "d block",
    "circle", "circles", "parabola", "ellipse", "hyperbola", "complex numbers", "quadratic equations",
    "quadratic equation", "trigonometric equations", "trigonometric ratios", "limits", "continuity",
    "differentiability", "differentiation", "maxima and minima", "indefinite integration",
    "definite integration", "indefinite integrals", "definite integrals", "cell division", "digestion",
}

_ROMAN_CLASS = {"ix": "9", "x": "10", "xi": "11", "xii": "12"}


def clean_label(v) -> str:
    """Trim, collapse inner whitespace, unify dashes. Keeps the user's capitalisation."""
    s = str(v or "").replace(" ", " ")
    s = re.sub(r"[‒-―−]", "-", s)
    s = re.sub(r"\s+", " ", s).strip(" \t\r\n.;,")
    return s


_SMALL = {"and", "of", "in", "the", "a", "an", "to", "for", "on", "with", "by", "its"}


def smart_title(v) -> str:
    """'mole concept' → 'Mole Concept', keeps acronyms/formulas ('pH', 'SHM', 'H2O') as typed."""
    words = clean_label(v).split(" ")
    out = []
    for i, w in enumerate(words):
        if not w:
            continue
        if any(c.isupper() for c in w[1:]) or any(c.isdigit() for c in w):
            out.append(w)
        elif i and w.lower() in _SMALL:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def label_key(v) -> str:
    """Case/spacing-insensitive key used to merge spelling variants of the same label."""
    return re.sub(r"[^a-z0-9]+", " ", clean_label(v).lower()).strip()


def _key(v) -> str:
    """Comparison key: 'The d- and f-Block Elements' → 'd f block elements'."""
    s = clean_label(v).lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    words = [w for w in s.split() if w not in ("the", "and", "of", "in", "its", "their", "a", "an")]
    return " ".join(words)


def normalize_class(v) -> str:
    """'XI' / '11th' / 'Class-11' / '+1' → '11'; 'drop' / 'repeater' → 'Dropper'; '' stays ''."""
    s = clean_label(v).lower()
    if not s:
        return ""
    if re.search(r"\b(drop+er|drop|repeater|target)\b", s):
        return "Dropper"
    if re.fullmatch(r"\+\s*1|first year|1st year|fy", s):
        return "11"
    if re.fullmatch(r"\+\s*2|second year|2nd year|sy", s):
        return "12"
    s2 = re.sub(r"\b(class|std|standard|grade|cls)\b", " ", s)
    s2 = re.sub(r"[^a-z0-9]+", " ", s2).strip()
    if s2 in _ROMAN_CLASS:
        return _ROMAN_CLASS[s2]
    m = re.fullmatch(r"(9|10|11|12)\s*(th)?", s2)
    if m:
        return m.group(1)
    if re.fullmatch(r"(11|xi)\s*(and|&|\+|/|-|,)?\s*(12|xii)", s):
        return "11-12"
    return clean_label(v)


_TOPIC_KEYS = {_key(a) for a in _TOPIC_LEVEL_ALIASES}

# lookup tables built once: key → canonical chapter, per subject
_CANON: Dict[str, Dict[str, str]] = {}
_CLASSES_OF: Dict[Tuple[str, str], List[str]] = {}
for _subj, _by_class in SYLLABUS.items():
    _CANON[_subj] = {}
    for _cls, _chapters in _by_class.items():
        for _ch in _chapters:
            _CANON[_subj][_key(_ch)] = _ch
            _CLASSES_OF.setdefault((_subj, _ch), [])
            if _cls not in _CLASSES_OF[(_subj, _ch)]:
                _CLASSES_OF[(_subj, _ch)].append(_cls)
    for _alias, _ch in _CHAPTER_ALIASES.get(_subj, {}).items():
        _CANON[_subj].setdefault(_key(_alias), _ch)


def canonical_chapter(subject: str, chapter) -> Tuple[str, bool]:
    """Return (chapter, matched). Unknown chapters come back cleaned but unchanged."""
    ch = clean_label(chapter)
    if not ch or subject not in _CANON:
        return ch, False
    table = _CANON[subject]
    k = _key(ch)
    if not k:
        return ch, False
    if k in table:
        return table[k], True
    # chapter number prefixes like "Ch 4 - Laws of Motion" / "4. Laws of Motion"
    k2 = re.sub(r"^(ch|chapter|unit|lesson)?\s*\d+\s*", "", k).strip()
    if k2 and k2 in table:
        return table[k2], True
    close = difflib.get_close_matches(k2 or k, list(table), n=1, cutoff=0.88)
    if close:
        return table[close[0]], True
    return ch, False


def chapter_subjects(chapter) -> List[str]:
    """Which subjects have this chapter (exact or alias)? Used to repair a wrong subject."""
    k = _key(chapter)
    if not k:
        return []
    return [s for s, table in _CANON.items() if k in table]


def classes_of(subject: str, chapter: str) -> List[str]:
    return list(_CLASSES_OF.get((subject, chapter), []))


def chapter_order(subject: str, student_class: str, chapter: str) -> Tuple[int, int, str]:
    """Sort key: NCERT order when known, otherwise alphabetical after the known ones."""
    for ci, cls in enumerate(CLASSES):
        lst = SYLLABUS.get(subject, {}).get(cls, [])
        if chapter in lst and (not student_class or student_class == cls or student_class not in CLASSES):
            return (0, ci * 100 + lst.index(chapter), chapter)
    return (1, 0, chapter.lower())


def normalize_tags(q: dict, fix_subject: bool = True) -> dict:
    """Return the cleaned {subject, student_class, chapter, topic} for one question.

    - subject: known spellings → Physics/Chemistry/Mathematics/Biology
    - class: XI/11th/Class 11 → 11 …; filled from the chapter when it exists in one class only
    - chapter: typo/alias → NCERT name; the original specific name becomes the topic if empty
    - subject: when ``fix_subject`` and the chapter only exists in one *other* subject, that subject
    """
    from question_sheet import normalize_subject   # local import keeps this module dependency-light

    raw_subject = q.get("subject") or ""
    subject = normalize_subject(raw_subject, default="") if raw_subject else ""
    subject = clean_label(subject)
    student_class = normalize_class(q.get("student_class"))
    raw_chapter = clean_label(q.get("chapter"))
    topic = clean_label(q.get("topic"))

    chapter, matched = canonical_chapter(subject, raw_chapter) if subject in SYLLABUS else (raw_chapter, False)
    if raw_chapter and not matched and fix_subject:
        owners = chapter_subjects(raw_chapter)
        if len(owners) == 1 and owners[0] != subject:
            subject = owners[0]
            chapter, matched = canonical_chapter(subject, raw_chapter)

    if matched and raw_chapter and not topic:
        # "Mole Concept" → chapter "Some Basic Concepts of Chemistry", topic "Mole Concept"
        if _key(raw_chapter) in _TOPIC_KEYS:
            topic = smart_title(raw_chapter)

    if matched and not student_class:
        cl = classes_of(subject, chapter)
        if len(cl) == 1:
            student_class = cl[0]

    return {"subject": subject or clean_label(raw_subject), "student_class": student_class,
            "chapter": chapter, "topic": topic}


def syllabus_prompt_block() -> str:
    """Compact syllabus text for the AI tagger prompt."""
    lines = []
    for subj, by_class in SYLLABUS.items():
        for cls, chapters in by_class.items():
            lines.append(f"{subj} | Class {cls}: " + "; ".join(chapters))
    return "\n".join(lines)
