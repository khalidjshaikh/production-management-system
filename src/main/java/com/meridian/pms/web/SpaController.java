package com.meridian.pms.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards client-side routes to the bundled React application. Files under
 * /assets are served directly by Spring's static resource handler.
 */
@Controller
public class SpaController {

    @GetMapping({
            "/",
            "/dashboard",
            "/wells",
            "/wells/**",
            "/production",
            "/production/**",
            "/downtime",
            "/downtime/**",
            "/forecast",
            "/forecast/**"
    })
    public String forwardToApp() {
        return "forward:/index.html";
    }
}
