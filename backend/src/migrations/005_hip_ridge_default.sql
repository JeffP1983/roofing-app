UPDATE materials
SET is_default = TRUE
WHERE is_default = FALSE
  AND category_id = (SELECT id FROM material_categories WHERE name = 'hip_ridge')
  AND manufacturer = 'GAF'
  AND name = 'Z-Ridge 33LF';
