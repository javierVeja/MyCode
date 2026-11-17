module.exports = async function handler(req, res) {
   if (req.method !== "GET") {
      return res.status(405).json({
         error: "Method not allowed",
      });
   }

   const query = String(req.query.q || "").trim();

   if (!query) {
      return res.status(400).json({
         error: "Missing food search query",
      });
   }

   const apiKey = process.env.USDA_API_KEY;

   if (!apiKey) {
      return res.status(500).json({
         error: "USDA API key is not configured",
      });
   }

   try {
      const params = new URLSearchParams({
         api_key: apiKey,
         query: query,
         pageSize: "12",
      });

      const response = await fetch(
         `https://api.nal.usda.gov/fdc/v1/foods/search?${params.toString()}`
      );

      if (!response.ok) {
         throw new Error(`USDA returned ${response.status}`);
      }

      const data = await response.json();

      const foods = (data.foods || []).map((food) => {
         const getNutrient = (...names) => {
            const nutrient = (food.foodNutrients || []).find((item) =>
               names.some(
                  (name) =>
                     item.nutrientName?.toLowerCase() ===
                     name.toLowerCase()
               )
            );

            return Number(nutrient?.value || 0);
         };

         return {
            fdcId: food.fdcId,

            name: food.description || "Unknown food",

            brand:
               food.brandOwner ||
               food.brandName ||
               "",

            barcode: food.gtinUpc || "",

            servingSize: food.servingSize || null,

            servingUnit: food.servingSizeUnit || "",

            calories: getNutrient(
               "Energy",
               "Energy (Atwater General Factors)",
               "Energy (Atwater Specific Factors)"
            ),

            protein: getNutrient("Protein"),

            carbs: getNutrient(
               "Carbohydrate, by difference"
            ),

            fat: getNutrient(
               "Total lipid (fat)"
            ),
         };
      });

      return res.status(200).json({
         query: query,
         count: foods.length,
         foods: foods,
      });
   } catch (error) {
      console.error(
         "USDA FoodData Central error:",
         error
      );

      return res.status(500).json({
         error: "Unable to search USDA FoodData Central",
         details: error.message,
      });
   }
};
