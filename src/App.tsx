const App = () => {
  const onClick = async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => {
        const rgbToHex = (rgb: string) => {
          const rgbaMatch = rgb.match(/\d+(\.\d+)?/g);
          if (!rgbaMatch) return rgb;

          const [r, g, b, a] = rgbaMatch.map(Number);

          if (rgbaMatch.length === 4 && a === 0) return "transparent";

          const toHex = (n: number) => n.toString(16).padStart(2, "0");
          return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };

        const pickerId = "__picker-overlay";
        if (document.getElementById(pickerId)) return;

        // Function to remove outline from all elements
        const removeAllOutlines = () => {
          const elements = document.querySelectorAll('*');
          elements.forEach(el => {
            if (el instanceof HTMLElement) {
              el.style.outline = '';
            }
          });
        };

        const overlay = document.createElement("div");
        overlay.id = pickerId;
        overlay.style.position = "fixed";
        overlay.style.top = "20px";
        overlay.style.left = "20px";
        overlay.style.width = "min(500px, calc(100vw - 40px))";
        overlay.style.maxHeight = "500px";
        overlay.style.backgroundColor = "#ffffff";
        overlay.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.15)";
        overlay.style.borderRadius = "12px";
        overlay.style.zIndex = "999999";
        overlay.style.overflow = "hidden";
        overlay.style.display = "flex";
        overlay.style.flexDirection = "column";
        overlay.style.color = "#1a1a1a";
        overlay.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        overlay.style.cursor = "move";
        overlay.style.userSelect = "none";
        overlay.style.transition = "all 0.2s ease";

        // Add drag handle
        const dragHandle = document.createElement("div");
        dragHandle.style.position = "relative";
        dragHandle.style.flexShrink = "0";
        dragHandle.style.height = "48px";
        dragHandle.style.backgroundColor = "#f8f9fa";
        dragHandle.style.borderBottom = "1px solid #e9ecef";
        dragHandle.style.cursor = "move";
        dragHandle.style.display = "flex";
        dragHandle.style.alignItems = "center";
        dragHandle.style.padding = "0 16px";
        dragHandle.style.justifyContent = "space-between";
        dragHandle.style.borderTopLeftRadius = "12px";
        dragHandle.style.borderTopRightRadius = "12px";

        const title = document.createElement("h3");
        title.textContent = "Style Inspector";
        title.style.margin = "0";
        title.style.fontSize = "16px";
        title.style.fontWeight = "600";
        title.style.color = "#212529";
        title.style.display = "flex";
        title.style.alignItems = "center";
        title.style.gap = "8px";

        // Add icon to title
        const icon = document.createElement("span");
        icon.innerHTML = "🎨";
        icon.style.fontSize = "18px";
        title.prepend(icon);

        const closeButton = document.createElement("button");
        closeButton.id = "close-overlay";
        closeButton.textContent = "×";
        closeButton.style.background = "none";
        closeButton.style.border = "none";
        closeButton.style.fontSize = "24px";
        closeButton.style.cursor = "pointer";
        closeButton.style.color = "#6c757d";
        closeButton.style.padding = "0";
        closeButton.style.width = "32px";
        closeButton.style.height = "32px";
        closeButton.style.display = "flex";
        closeButton.style.alignItems = "center";
        closeButton.style.justifyContent = "center";
        closeButton.style.borderRadius = "6px";
        closeButton.style.transition = "all 0.2s ease";
        closeButton.onmouseover = () => {
          closeButton.style.backgroundColor = "#f1f3f5";
          closeButton.style.color = "#212529";
        };
        closeButton.onmouseout = () => {
          closeButton.style.backgroundColor = "transparent";
          closeButton.style.color = "#6c757d";
        };

        // Create a separate function for closing
        const closeOverlay = () => {
          if (lastSelectedElement) {
            lastSelectedElement.style.outline = "";
          }
          lastSelectedElement = null;
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          removeAllOutlines();
          // Remove the click event listener
          document.removeEventListener("click", handleClick, true);
        };

        closeButton.addEventListener("click", closeOverlay);

        dragHandle.appendChild(title);
        dragHandle.appendChild(closeButton);
        overlay.appendChild(dragHandle);

        // Add content container
        const content = document.createElement("div");
        content.style.flex = "1";
        content.style.overflowY = "auto";
        content.style.padding = "20px";
        content.style.paddingTop = "16px";
        content.style.backgroundColor = "#ffffff";

        const overlayTemplate = `
          <div style="margin: 0; padding: 0;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #495057; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <span style="color: #868e96;">📄</span>
              Selected HTML
            </p>
            <div style="margin: 0; padding: 16px; width: 100%; box-shadow: inset 0 0 0 1px #e9ecef; max-height: 300px; overflow-y: scroll; border-radius: 8px; background-color: #f8f9fa; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;" id="overlay-content"></div>
          </div>
        `;

        content.innerHTML = overlayTemplate;
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        const overlayContent = content.querySelector("#overlay-content");

        let lastSelectedElement: HTMLElement | null = null;
        let isFirstClick = true;

        // Draggable functionality
        let isDragging = false;
        let currentX: number = 0;
        let currentY: number = 0;
        let initialX: number = 0;
        let initialY: number = 0;
        let xOffset: number = 0;
        let yOffset: number = 0;

        const dragStart = (e: MouseEvent) => {
          if (e.target === dragHandle || e.target === title || e.target === closeButton) {
            isDragging = true;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            overlay.style.transition = 'none';
          }
        };

        const drag = (e: MouseEvent) => {
          if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            requestAnimationFrame(() => {
              overlay.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            });
          }
        };

        const dragEnd = () => {
          if (isDragging) {
            isDragging = false;
            overlay.style.transition = 'all 0.2s ease';
          }
        };

        dragHandle.addEventListener("mousedown", dragStart);
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("mouseleave", dragEnd);

        // Create click handler function
        const handleClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          const isInsideOverlay = target.closest(`#${pickerId}`);
          
          if (target.id === "close-overlay") {
            closeOverlay();
            return;
          }

          if (isInsideOverlay) {
            const targetElement = e.target as HTMLElement;
            
            // Allow clicks on input elements and HTML tags
            if (targetElement.tagName === "INPUT" || 
                targetElement.tagName === "SELECT" || 
                targetElement.tagName === "BUTTON" ||
                targetElement.classList.contains('html-tag')) {
              return;
            }

            e.stopPropagation();
            e.preventDefault();
            if (overlayContent) {
              overlayContent.innerHTML = "<p>Click outside the overlay to inspect elements.</p>";
            }
            return;
          }

          // Check if the clicked element or its parent is a link
          const clickedLink = target.closest('a');
          if (clickedLink) {
            if (isFirstClick) {
              isFirstClick = false;
              e.preventDefault();
              e.stopPropagation();
              
              // Use the link element for inspection
              const elementToInspect = clickedLink;
              removeAllOutlines();
              lastSelectedElement = elementToInspect;
              lastSelectedElement.style.outline = "2px solid #007bff";

              showInspectorForElement(elementToInspect);
            } else {
              // On second click, allow the link to work normally
              isFirstClick = true;
              removeAllOutlines();
              return; // Let the click event propagate normally
            }
          } else {
            // For non-link elements, always show inspector on first click
            removeAllOutlines();
            lastSelectedElement = target;
            lastSelectedElement.style.outline = "2px solid #007bff";
            showInspectorForElement(target);
          }
        };

        // Add the click event listener with capture phase
        document.addEventListener("click", handleClick, true);

        // Function to format HTML with indentation and syntax highlighting
        const formatHTML = (element: HTMLElement) => {
          const elementMap = new Map<number, Element>();
          let counter = 0;
          
          const formatNode = (node: Node, level: number = 0) => {
            let result = '';
            const indent = ' '.repeat(level);
            
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              const tagName = element.tagName.toLowerCase();
              const elementIndex = counter++;
              elementMap.set(elementIndex, element);
              
              const attributes = Array.from(element.attributes)
                .map(attr => ` <span style="color: #9b59b6;">${attr.name}</span>="<span style="color: #e67e22;">${attr.value}</span>"`)
                .join('');
              
              const tagStyle = `color: #3498db; 
                       cursor: pointer; 
                       user-select: none;
                       padding: 2px 4px;
                       border-radius: 3px;
                       transition: all 0.2s ease;`;
              
              result += `${indent}<span class="html-tag" data-index="${elementIndex}" style="${tagStyle}">&lt;${tagName}</span>${attributes}<span class="html-tag" data-index="${elementIndex}" style="${tagStyle}">&gt;</span>\n`;
              
              if (element.childNodes.length > 0) {
                for (const child of Array.from(element.childNodes)) {
                  result += formatNode(child, level + 1);
                }
                result += `${indent}<span class="html-tag" data-index="${elementIndex}" style="${tagStyle}">&lt;/${tagName}&gt;</span>\n`;
              } else {
                result = result.replace(/\n$/, '');
                result += `<span class="html-tag" data-index="${elementIndex}" style="${tagStyle}">&lt;/${tagName}&gt;</span>\n`;
              }
            } else if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent?.trim();
              if (text) {
                result += `${indent}<span style="color: #2c3e50;">${text}</span>\n`;
              }
            }
            
            return result;
          };
          
          const html = formatNode(element);
          return { html, elementMap };
        };

        function showInspectorForElement(element: HTMLElement) {
          const { html, elementMap } = formatHTML(element);
          const computedStyle = window.getComputedStyle(element);
          
          // Create tabs container
          const tabsContainer = document.createElement('div');
          tabsContainer.style.display = 'flex';
          tabsContainer.style.gap = '8px';
          tabsContainer.style.marginBottom = '12px';
          tabsContainer.style.borderBottom = '1px solid #e9ecef';
          tabsContainer.style.paddingBottom = '8px';

          // Create HTML tab
          const htmlTab = document.createElement('button');
          htmlTab.textContent = 'HTML';
          htmlTab.style.padding = '6px 12px';
          htmlTab.style.border = 'none';
          htmlTab.style.backgroundColor = '#f8f9fa';
          htmlTab.style.borderRadius = '4px';
          htmlTab.style.cursor = 'pointer';
          htmlTab.style.fontSize = '13px';
          htmlTab.style.color = '#495057';
          htmlTab.style.fontWeight = '500';
          htmlTab.style.transition = 'all 0.2s ease';

          // Create CSS tab
          const cssTab = document.createElement('button');
          cssTab.textContent = 'CSS';
          cssTab.style.padding = '6px 12px';
          cssTab.style.border = 'none';
          cssTab.style.backgroundColor = '#f8f9fa';
          cssTab.style.borderRadius = '4px';
          cssTab.style.cursor = 'pointer';
          cssTab.style.fontSize = '13px';
          cssTab.style.color = '#495057';
          cssTab.style.fontWeight = '500';
          cssTab.style.transition = 'all 0.2s ease';

          // Create content containers
          const htmlContent = document.createElement('div');
          htmlContent.style.display = 'block';
          htmlContent.innerHTML = `
            <pre style="
              margin: 0;
              padding: 0;
              font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
              font-size: 13px;
              line-height: 1.5;
              white-space: pre;
              tab-size: 2;
              color: #2c3e50;
            ">${html}</pre>
          `;

          // Add click handlers for HTML tags
          const htmlTags = htmlContent.querySelectorAll('.html-tag');
          htmlTags.forEach(tag => {
            tag.addEventListener('click', (e) => {
              e.stopPropagation();
              const elementIndex = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0');
              const selectedElement = elementMap.get(elementIndex) as HTMLElement;
              
              if (selectedElement) {
                removeAllOutlines();
                lastSelectedElement = selectedElement;
                lastSelectedElement.style.outline = "2px solid #007bff";
                showInspectorForElement(lastSelectedElement);
              }
            });
          });

          // Add hover styles for HTML tags
          const style = document.createElement('style');
          style.textContent = `
            .html-tag:hover {
              background-color: rgba(52, 152, 219, 0.1);
            }
          `;
          document.head.appendChild(style);

          // Create CSS content
          const cssContent = document.createElement('div');
          cssContent.style.display = 'none';
          
          // Format CSS styles
          let cssStyles = '';
          const styleProperties = [
            'display', 'position', 'top', 'right', 'bottom', 'left',
            'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
            'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
            'border-radius', 'background', 'background-color', 'background-image',
            'color', 'font-family', 'font-size', 'font-weight', 'line-height',
            'text-align', 'text-decoration', 'text-transform', 'letter-spacing',
            'opacity', 'visibility', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
            'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
            'grid', 'grid-template-columns', 'grid-template-rows', 'grid-gap',
            'transform', 'transition', 'animation', 'box-shadow', 'filter'
          ];

          styleProperties.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== '0px' && value !== '0') {
              cssStyles += `<div style="margin-bottom: 4px;">
                <span style="color: #9b59b6;">${prop}</span>: 
                <span style="color: #e67e22;">${value}</span>;
              </div>`;
            }
          });

          cssContent.innerHTML = `
            <div style="
              font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
              font-size: 13px;
              line-height: 1.5;
              color: #2c3e50;
              padding: 8px;
              background: #f8f9fa;
              border-radius: 4px;
            ">
              ${cssStyles}
            </div>
          `;

          // Add tab click handlers
          htmlTab.addEventListener('click', () => {
            htmlTab.style.backgroundColor = '#e9ecef';
            cssTab.style.backgroundColor = '#f8f9fa';
            htmlContent.style.display = 'block';
            cssContent.style.display = 'none';
          });

          cssTab.addEventListener('click', () => {
            cssTab.style.backgroundColor = '#e9ecef';
            htmlTab.style.backgroundColor = '#f8f9fa';
            cssContent.style.display = 'block';
            htmlContent.style.display = 'none';
          });

          // Set initial active tab
          htmlTab.style.backgroundColor = '#e9ecef';

          // Assemble the content
          const content = document.createElement('div');
          content.appendChild(tabsContainer);
          content.appendChild(htmlContent);
          content.appendChild(cssContent);
          tabsContainer.appendChild(htmlTab);
          tabsContainer.appendChild(cssTab);

          (overlayContent as HTMLElement).innerHTML = '';
          (overlayContent as HTMLElement).appendChild(content);

          // Remove all previous input sections
          const existingInputDivs = overlayContent!.parentElement!.querySelectorAll('div[style*="display: grid"]');
          existingInputDivs.forEach(div => div.remove());

          const tagName = element.tagName.toLowerCase();
          let styleInputsTemplate = "";

          // Check for nested elements
          const hasImage = element.querySelector('img');
          const hasText = element.textContent?.trim() !== '';
          const isLink = tagName === 'a' || tagName === 'button';
          const isImage = ["img", "svg"].includes(tagName);
          const isTextElement = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "strong", "b", "a"].includes(tagName);
          const isLayoutElement = ["div", "section", "article", "main", "header", "footer", "nav", "aside", "form"].includes(tagName);

          // Show styles only if an element is selected
          if (!element || element === document.body) {
            const bodyStyle = window.getComputedStyle(document.body);
            const bodyWidth = parseInt(bodyStyle.width, 10);
            const bodyHeight = parseInt(bodyStyle.height, 10);
            const bodyMargin = parseInt(bodyStyle.margin, 10);
            // const bodyPadding = parseInt(bodyStyle.padding, 10);
            const bodyBackgroundColor = rgbToHex(bodyStyle.backgroundColor);
            const bodyColor = rgbToHex(bodyStyle.color);
            const bodyFontSize = parseInt(bodyStyle.fontSize, 10);
            const bodyFontFamily = bodyStyle.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            const bodyLineHeight = bodyStyle.lineHeight;
            const bodyDisplay = bodyStyle.display;
            const bodyPosition = bodyStyle.position;
            const bodyOverflow = bodyStyle.overflow;
            
            overlayContent!.insertAdjacentHTML("afterend", `
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Width</label>
                  <input type="number" value="${bodyWidth}" id="width-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Height</label>
                  <input type="number" value="${bodyHeight}" id="height-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Margin</label>
                  <input type="number" value="${bodyMargin}" id="margin-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Padding</label>
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Top</label>
                      <input type="number" value="${parseInt(computedStyle.paddingTop)}" id="padding-top-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Right</label>
                      <input type="number" value="${parseInt(computedStyle.paddingRight)}" id="padding-right-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Bottom</label>
                      <input type="number" value="${parseInt(computedStyle.paddingBottom)}" id="padding-bottom-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Left</label>
                      <input type="number" value="${parseInt(computedStyle.paddingLeft)}" id="padding-left-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Background Color</label>
                  <div style="display: flex; gap: 8px; width: 100%;">
                    <input type="color" value="${bodyBackgroundColor}" id="background-color-input" style="width: 40px; height: 40px; padding: 0; border: none; border-radius: 6px; flex-shrink: 0; cursor: pointer;" />
                    <input type="text" value="${bodyBackgroundColor}" id="background-color-hex-input" style="flex: 1; padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; min-width: 0; background-color: white; transition: all 0.2s ease;" />
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Text Color</label>
                  <div style="display: flex; gap: 8px; width: 100%;">
                    <input type="color" value="${bodyColor}" id="color-input" style="width: 40px; height: 40px; padding: 0; border: none; border-radius: 6px; flex-shrink: 0; cursor: pointer;" />
                    <input type="text" value="${bodyColor}" id="color-hex-input" style="flex: 1; padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; min-width: 0; background-color: white; transition: all 0.2s ease;" />
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Font Size</label>
                  <input type="number" value="${bodyFontSize}" id="font-size-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Font Family</label>
                  <select id="font-family-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease; font-family: inherit;">
                    <option value="${bodyFontFamily}" selected>${bodyFontFamily}</option>
                    <option value="'Inter', sans-serif" style="font-family: 'Inter', sans-serif;">Inter</option>
                    <option value="'Lato', sans-serif" style="font-family: 'Lato', sans-serif;">Lato</option>
                    <option value="'Merriweather', serif" style="font-family: 'Merriweather', serif;">Merriweather</option>
                    <option value="'Montserrat', sans-serif" style="font-family: 'Montserrat', sans-serif;">Montserrat</option>
                    <option value="'Noto Sans', sans-serif" style="font-family: 'Noto Sans', sans-serif;">Noto Sans</option>
                    <option value="'Open Sans', sans-serif" style="font-family: 'Open Sans', sans-serif;">Open Sans</option>
                    <option value="'Oswald', sans-serif" style="font-family: 'Oswald', sans-serif;">Oswald</option>
                    <option value="'Raleway', sans-serif" style="font-family: 'Raleway', sans-serif;">Raleway</option>
                    <option value="'Roboto', sans-serif" style="font-family: 'Roboto', sans-serif;">Roboto</option>
                    <option value="Arial, sans-serif" style="font-family: Arial, sans-serif;">Arial</option>
                    <option value="'Helvetica Neue', sans-serif" style="font-family: 'Helvetica Neue', sans-serif;">Helvetica Neue</option>
                    <option value="'Times New Roman', serif" style="font-family: 'Times New Roman', serif;">Times New Roman</option>
                    <option value="Georgia, serif" style="font-family: Georgia, serif;">Georgia</option>
                    <option value="'Courier New', monospace" style="font-family: 'Courier New', monospace;">Courier New</option>
                    <option value="'Lucida Console', monospace" style="font-family: 'Lucida Console', monospace;">Lucida Console</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Line Height</label>
                  <input type="text" value="${bodyLineHeight}" id="line-height-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Display</label>
                  <select id="display-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;">
                    <option value="block" ${bodyDisplay === "block" ? "selected" : ""}>Block</option>
                    <option value="flex" ${bodyDisplay === "flex" ? "selected" : ""}>Flex</option>
                    <option value="grid" ${bodyDisplay === "grid" ? "selected" : ""}>Grid</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Position</label>
                  <select id="position-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;">
                    <option value="static" ${bodyPosition === "static" ? "selected" : ""}>Static</option>
                    <option value="relative" ${bodyPosition === "relative" ? "selected" : ""}>Relative</option>
                    <option value="absolute" ${bodyPosition === "absolute" ? "selected" : ""}>Absolute</option>
                    <option value="fixed" ${bodyPosition === "fixed" ? "selected" : ""}>Fixed</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Overflow</label>
                  <select id="overflow-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;">
                    <option value="visible" ${bodyOverflow === "visible" ? "selected" : ""}>Visible</option>
                    <option value="hidden" ${bodyOverflow === "hidden" ? "selected" : ""}>Hidden</option>
                    <option value="scroll" ${bodyOverflow === "scroll" ? "selected" : ""}>Scroll</option>
                    <option value="auto" ${bodyOverflow === "auto" ? "selected" : ""}>Auto</option>
                  </select>
                </div>
              </div>
            `);

            // Add event listeners for body styles
            const widthInput = document.getElementById("width-input") as HTMLInputElement;
            widthInput?.addEventListener("input", (e) => {
              document.body.style.width = `${(e.target as HTMLInputElement).value}px`;
            });

            const heightInput = document.getElementById("height-input") as HTMLInputElement;
            heightInput?.addEventListener("input", (e) => {
              document.body.style.height = `${(e.target as HTMLInputElement).value}px`;
            });

            const marginInput = document.getElementById("margin-input") as HTMLInputElement;
            marginInput?.addEventListener("input", (e) => {
              document.body.style.margin = `${(e.target as HTMLInputElement).value}px`;
            });

            const paddingTopInput = document.getElementById("padding-top-input") as HTMLInputElement;
            paddingTopInput?.addEventListener("input", (e) => {
              document.body.style.paddingTop = `${(e.target as HTMLInputElement).value}px`;
            });

            const paddingRightInput = document.getElementById("padding-right-input") as HTMLInputElement;
            paddingRightInput?.addEventListener("input", (e) => {
              document.body.style.paddingRight = `${(e.target as HTMLInputElement).value}px`;
            });

            const paddingBottomInput = document.getElementById("padding-bottom-input") as HTMLInputElement;
            paddingBottomInput?.addEventListener("input", (e) => {
              document.body.style.paddingBottom = `${(e.target as HTMLInputElement).value}px`;
            });

            const paddingLeftInput = document.getElementById("padding-left-input") as HTMLInputElement;
            paddingLeftInput?.addEventListener("input", (e) => {
              document.body.style.paddingLeft = `${(e.target as HTMLInputElement).value}px`;
            });

            const bgColorInput = document.getElementById("background-color-input") as HTMLInputElement;
            const bgColorHexInput = document.getElementById("background-color-hex-input") as HTMLInputElement;
            bgColorInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
              document.body.style.backgroundColor = value;
              if (bgColorHexInput) bgColorHexInput.value = value;
            });
            bgColorHexInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
              document.body.style.backgroundColor = value;
              if (bgColorInput) bgColorInput.value = value;
            });

            const colorInput = document.getElementById("color-input") as HTMLInputElement;
            const colorHexInput = document.getElementById("color-hex-input") as HTMLInputElement;
            colorInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
              document.body.style.color = value;
              if (colorHexInput) colorHexInput.value = value;
            });
            colorHexInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
              document.body.style.color = value;
              if (colorInput) colorInput.value = value;
            });

            const fontSizeInput = document.getElementById("font-size-input") as HTMLInputElement;
            fontSizeInput?.addEventListener("input", (e) => {
              document.body.style.fontSize = `${(e.target as HTMLInputElement).value}px`;
            });

            const fontFamilyInput = document.getElementById("font-family-input") as HTMLSelectElement;
            fontFamilyInput?.addEventListener("change", (e) => {
              document.body.style.fontFamily = (e.target as HTMLSelectElement).value;
            });

            const lineHeightInput = document.getElementById("line-height-input") as HTMLInputElement;
            lineHeightInput?.addEventListener("input", (e) => {
              document.body.style.lineHeight = (e.target as HTMLInputElement).value;
            });

            const displayInput = document.getElementById("display-input") as HTMLSelectElement;
            displayInput?.addEventListener("change", (e) => {
              document.body.style.display = (e.target as HTMLSelectElement).value;
            });

            const positionInput = document.getElementById("position-input") as HTMLSelectElement;
            positionInput?.addEventListener("change", (e) => {
              document.body.style.position = (e.target as HTMLSelectElement).value;
            });

            const overflowInput = document.getElementById("overflow-input") as HTMLSelectElement;
            overflowInput?.addEventListener("change", (e) => {
              document.body.style.overflow = (e.target as HTMLSelectElement).value;
            });

            return;
          }

          // Show link-specific styles
          if (isLink) {
            const linkStyle = window.getComputedStyle(element);
            const textDecoration = linkStyle.textDecoration;
            const hoverColor = linkStyle.getPropertyValue('--hover-color') || '#0056b3';
            
            styleInputsTemplate += `
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Text Decoration</label>
                  <select id="text-decoration-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="none" ${textDecoration === "none" ? "selected" : ""}>None</option>
                    <option value="underline" ${textDecoration.includes("underline") ? "selected" : ""}>Underline</option>
                    <option value="overline" ${textDecoration.includes("overline") ? "selected" : ""}>Overline</option>
                    <option value="line-through" ${textDecoration.includes("line-through") ? "selected" : ""}>Line Through</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Hover Color</label>
                  <div style="display: flex; gap: 6px; width: 100%;">
                    <input type="color" value="${hoverColor}" id="hover-color-input" style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 4px; flex-shrink: 0;" />
                    <input type="text" value="${hoverColor}" id="hover-color-hex-input" style="flex: 1; padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; min-width: 0;" />
                  </div>
                </div>
              </div>
            `;
          }

          // Show image-specific styles
          if (isImage || hasImage) {
            const width = parseInt(computedStyle.width, 10);
            const height = parseInt(computedStyle.height, 10);
            const objectFit = computedStyle.objectFit || "fill";
            const borderRadius = parseInt(computedStyle.borderRadius, 10);
            const opacity = parseFloat(computedStyle.opacity);
            const filter = computedStyle.filter;
            
            styleInputsTemplate += `
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Width</label>
                  <input type="number" value="${width}" id="width-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Height</label>
                  <input type="number" value="${height}" id="height-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Object Fit</label>
                  <select id="object-fit-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;">
                    <option value="fill" ${objectFit === "fill" ? "selected" : ""}>Fill</option>
                    <option value="contain" ${objectFit === "contain" ? "selected" : ""}>Contain</option>
                    <option value="cover" ${objectFit === "cover" ? "selected" : ""}>Cover</option>
                    <option value="none" ${objectFit === "none" ? "selected" : ""}>None</option>
                    <option value="scale-down" ${objectFit === "scale-down" ? "selected" : ""}>Scale Down</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Border Radius</label>
                  <input type="number" value="${borderRadius}" id="border-radius-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Opacity</label>
                  <input type="range" min="0" max="1" step="0.1" value="${opacity}" id="opacity-input" style="width: 100%;" />
                  <span style="font-size: 12px; color: #666; text-align: center;">${opacity}</span>
                </div>
                <div style="grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Filter</label>
                  <select id="filter-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;">
                    <option value="none" ${filter === "none" ? "selected" : ""}>None</option>
                    <option value="blur(2px)" ${filter === "blur(2px)" ? "selected" : ""}>Blur (Light)</option>
                    <option value="blur(5px)" ${filter === "blur(5px)" ? "selected" : ""}>Blur (Medium)</option>
                    <option value="blur(10px)" ${filter === "blur(10px)" ? "selected" : ""}>Blur (Strong)</option>
                    <option value="brightness(0.8)" ${filter === "brightness(0.8)" ? "selected" : ""}>Darker</option>
                    <option value="brightness(1.2)" ${filter === "brightness(1.2)" ? "selected" : ""}>Brighter</option>
                    <option value="contrast(0.8)" ${filter === "contrast(0.8)" ? "selected" : ""}>Lower Contrast</option>
                    <option value="contrast(1.2)" ${filter === "contrast(1.2)" ? "selected" : ""}>Higher Contrast</option>
                    <option value="grayscale(100%)" ${filter === "grayscale(100%)" ? "selected" : ""}>Grayscale</option>
                    <option value="sepia(100%)" ${filter === "sepia(100%)" ? "selected" : ""}>Sepia</option>
                    <option value="invert(100%)" ${filter === "invert(100%)" ? "selected" : ""}>Invert</option>
                    <option value="hue-rotate(90deg)" ${filter === "hue-rotate(90deg)" ? "selected" : ""}>Hue Rotate</option>
                    <option value="saturate(200%)" ${filter === "saturate(200%)" ? "selected" : ""}>Saturate</option>
                    <option value="saturate(50%)" ${filter === "saturate(50%)" ? "selected" : ""}>Desaturate</option>
                    <option value="custom">Custom...</option>
                  </select>
                  <div id="custom-filter-container" style="display: none; margin-top: 8px;">
                    <input type="text" id="custom-filter-input" placeholder="e.g., brightness(1.2) contrast(0.8)" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                  </div>
                </div>
              </div>
            `;
          }

          // Show text-specific styles
          if (isTextElement || hasText) {
              const fontSize = parseInt(computedStyle.fontSize, 10);
              const color = rgbToHex(computedStyle.color);
            const fontWeight = computedStyle.fontWeight;
            const fontFamily = computedStyle.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            const baseFontFamily = window.getComputedStyle(document.body).fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            // const lineHeight = computedStyle.lineHeight;
            // const letterSpacing = computedStyle.letterSpacing;
            // const textAlign = computedStyle.textAlign;
            
            styleInputsTemplate += `
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Font Size</label>
                  <input type="number" value="${fontSize}" id="font-size-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Font Weight</label>
                  <select id="font-weight-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease;">
                    <option value="normal" ${fontWeight === "normal" ? "selected" : ""}>Normal</option>
                    <option value="bold" ${fontWeight === "bold" ? "selected" : ""}>Bold</option>
                    <option value="lighter" ${fontWeight === "lighter" ? "selected" : ""}>Lighter</option>
                    <option value="bolder" ${fontWeight === "bolder" ? "selected" : ""}>Bolder</option>
                    <option value="100" ${fontWeight === "100" ? "selected" : ""}>100</option>
                    <option value="200" ${fontWeight === "200" ? "selected" : ""}>200</option>
                    <option value="300" ${fontWeight === "300" ? "selected" : ""}>300</option>
                    <option value="400" ${fontWeight === "400" ? "selected" : ""}>400</option>
                    <option value="500" ${fontWeight === "500" ? "selected" : ""}>500</option>
                    <option value="600" ${fontWeight === "600" ? "selected" : ""}>600</option>
                    <option value="700" ${fontWeight === "700" ? "selected" : ""}>700</option>
                    <option value="800" ${fontWeight === "800" ? "selected" : ""}>800</option>
                    <option value="900" ${fontWeight === "900" ? "selected" : ""}>900</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Text Color</label>
                  <div style="display: flex; gap: 8px; width: 100%;">
                    <input type="color" value="${color}" id="color-input" style="width: 40px; height: 40px; padding: 0; border: none; border-radius: 6px; flex-shrink: 0; cursor: pointer;" />
                    <input type="text" value="${color}" id="color-hex-input" style="flex: 1; padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; min-width: 0; background-color: white; transition: all 0.2s ease;" />
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Font Family</label>
                  <select id="font-family-input" style="padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white; transition: all 0.2s ease; font-family: inherit;">
                    <option value="${fontFamily}" selected>${fontFamily}</option>
                    <option value="${baseFontFamily}" style="font-family: ${baseFontFamily};">Base Font (${baseFontFamily})</option>
                    <option value="'Inter', sans-serif" style="font-family: 'Inter', sans-serif;">Inter</option>
                    <option value="'Lato', sans-serif" style="font-family: 'Lato', sans-serif;">Lato</option>
                    <option value="'Merriweather', serif" style="font-family: 'Merriweather', serif;">Merriweather</option>
                    <option value="'Montserrat', sans-serif" style="font-family: 'Montserrat', sans-serif;">Montserrat</option>
                    <option value="'Noto Sans', sans-serif" style="font-family: 'Noto Sans', sans-serif;">Noto Sans</option>
                    <option value="'Open Sans', sans-serif" style="font-family: 'Open Sans', sans-serif;">Open Sans</option>
                    <option value="'Oswald', sans-serif" style="font-family: 'Oswald', sans-serif;">Oswald</option>
                    <option value="'Raleway', sans-serif" style="font-family: 'Raleway', sans-serif;">Raleway</option>
                    <option value="'Roboto', sans-serif" style="font-family: 'Roboto', sans-serif;">Roboto</option>
                    <option value="Arial, sans-serif" style="font-family: Arial, sans-serif;">Arial</option>
                    <option value="'Helvetica Neue', sans-serif" style="font-family: 'Helvetica Neue', sans-serif;">Helvetica Neue</option>
                    <option value="'Times New Roman', serif" style="font-family: 'Times New Roman', serif;">Times New Roman</option>
                    <option value="Georgia, serif" style="font-family: Georgia, serif;">Georgia</option>
                    <option value="'Courier New', monospace" style="font-family: 'Courier New', monospace;">Courier New</option>
                    <option value="'Lucida Console', monospace" style="font-family: 'Lucida Console', monospace;">Lucida Console</option>
                  </select>
                </div>
              </div>
            `;
          }

          // Show layout-specific styles
          if (isLayoutElement) {
              // const padding = parseInt(computedStyle.padding, 10);
              const margin = parseInt(computedStyle.margin, 10);
              const backgroundColor = rgbToHex(computedStyle.backgroundColor);
              const bodyBackgroundColor = rgbToHex(window.getComputedStyle(document.body).backgroundColor);
              const safeBg = backgroundColor === "transparent" || backgroundColor === "rgba(0, 0, 0, 0)" ? bodyBackgroundColor : backgroundColor;
            const borderWidth = parseInt(computedStyle.borderWidth, 10);
            const borderColor = rgbToHex(computedStyle.borderColor);
            const borderRadius = parseInt(computedStyle.borderRadius, 10);
            const display = computedStyle.display;
            const position = computedStyle.position;
            const flexDirection = computedStyle.flexDirection;
            const justifyContent = computedStyle.justifyContent;
            const alignItems = computedStyle.alignItems;
            
            styleInputsTemplate += `
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Padding</label>
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Top</label>
                      <input type="number" value="${parseInt(computedStyle.paddingTop)}" id="padding-top-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Right</label>
                      <input type="number" value="${parseInt(computedStyle.paddingRight)}" id="padding-right-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Bottom</label>
                      <input type="number" value="${parseInt(computedStyle.paddingBottom)}" id="padding-bottom-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <label style="font-size: 11px; color: #868e96;">Left</label>
                      <input type="number" value="${parseInt(computedStyle.paddingLeft)}" id="padding-left-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                    </div>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Margin</label>
                  <input type="number" value="${margin}" id="margin-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Background Color</label>
                  <div style="display: flex; gap: 6px; width: 100%;">
                    <input type="color" value="${safeBg}" id="background-color-input" style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 4px; flex-shrink: 0;" />
                    <input type="text" value="${safeBg}" id="background-color-hex-input" style="flex: 1; padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; min-width: 0;" />
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Border Width</label>
                  <input type="number" value="${borderWidth}" id="border-width-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Border Color</label>
                  <div style="display: flex; gap: 6px; width: 100%;">
                    <input type="color" value="${borderColor}" id="border-color-input" style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 4px; flex-shrink: 0;" />
                    <input type="text" value="${borderColor}" id="border-color-hex-input" style="flex: 1; padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; min-width: 0;" />
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Border Radius</label>
                  <input type="number" value="${borderRadius}" id="border-radius-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Display</label>
                  <select id="display-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="block" ${display === "block" ? "selected" : ""}>Block</option>
                    <option value="inline" ${display === "inline" ? "selected" : ""}>Inline</option>
                    <option value="inline-block" ${display === "inline-block" ? "selected" : ""}>Inline Block</option>
                    <option value="flex" ${display === "flex" ? "selected" : ""}>Flex</option>
                    <option value="grid" ${display === "grid" ? "selected" : ""}>Grid</option>
                    <option value="none" ${display === "none" ? "selected" : ""}>None</option>
                  </select>
                </div>
                ${display === "grid" ? `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Grid Template Columns</label>
                  <select id="grid-template-columns-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="1fr" ${computedStyle.gridTemplateColumns === "1fr" ? "selected" : ""}>1 Column</option>
                    <option value="1fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 1fr" ? "selected" : ""}>2 Columns</option>
                    <option value="1fr 1fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 1fr 1fr" ? "selected" : ""}>3 Columns</option>
                    <option value="1fr 1fr 1fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 1fr 1fr 1fr" ? "selected" : ""}>4 Columns</option>
                    <option value="1fr 2fr" ${computedStyle.gridTemplateColumns === "1fr 2fr" ? "selected" : ""}>2 Columns (1:2)</option>
                    <option value="2fr 1fr" ${computedStyle.gridTemplateColumns === "2fr 1fr" ? "selected" : ""}>2 Columns (2:1)</option>
                    <option value="1fr 2fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 2fr 1fr" ? "selected" : ""}>3 Columns (1:2:1)</option>
                    <option value="auto 1fr" ${computedStyle.gridTemplateColumns === "auto 1fr" ? "selected" : ""}>Auto + Fill</option>
                    <option value="1fr auto" ${computedStyle.gridTemplateColumns === "1fr auto" ? "selected" : ""}>Fill + Auto</option>
                    <option value="custom" ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "1fr 2fr", "2fr 1fr", "1fr 2fr 1fr", "auto 1fr", "1fr auto"].includes(computedStyle.gridTemplateColumns) ? "selected" : ""}>Custom...</option>
                  </select>
                  <div id="custom-grid-columns-container" style="display: ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "1fr 2fr", "2fr 1fr", "1fr 2fr 1fr", "auto 1fr", "1fr auto"].includes(computedStyle.gridTemplateColumns) ? "block" : "none"}; margin-top: 8px;">
                    <input type="text" id="custom-grid-columns-input" value="${computedStyle.gridTemplateColumns}" placeholder="e.g., 1fr 1fr 1fr" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Grid Template Rows</label>
                  <select id="grid-template-rows-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="1fr" ${computedStyle.gridTemplateRows === "1fr" ? "selected" : ""}>1 Row</option>
                    <option value="1fr 1fr" ${computedStyle.gridTemplateRows === "1fr 1fr" ? "selected" : ""}>2 Rows</option>
                    <option value="1fr 1fr 1fr" ${computedStyle.gridTemplateRows === "1fr 1fr 1fr" ? "selected" : ""}>3 Rows</option>
                    <option value="1fr 1fr 1fr 1fr" ${computedStyle.gridTemplateRows === "1fr 1fr 1fr 1fr" ? "selected" : ""}>4 Rows</option>
                    <option value="auto 1fr" ${computedStyle.gridTemplateRows === "auto 1fr" ? "selected" : ""}>Auto + Fill</option>
                    <option value="1fr auto" ${computedStyle.gridTemplateRows === "1fr auto" ? "selected" : ""}>Fill + Auto</option>
                    <option value="auto 1fr auto" ${computedStyle.gridTemplateRows === "auto 1fr auto" ? "selected" : ""}>Header + Content + Footer</option>
                    <option value="custom" ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "auto 1fr", "1fr auto", "auto 1fr auto"].includes(computedStyle.gridTemplateRows) ? "selected" : ""}>Custom...</option>
                  </select>
                  <div id="custom-grid-rows-container" style="display: ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "auto 1fr", "1fr auto", "auto 1fr auto"].includes(computedStyle.gridTemplateRows) ? "block" : "none"}; margin-top: 8px;">
                    <input type="text" id="custom-grid-rows-input" value="${computedStyle.gridTemplateRows}" placeholder="e.g., auto 1fr auto" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                  </div>
                </div>
                ` : ''}
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Position</label>
                  <select id="position-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="static" ${position === "static" ? "selected" : ""}>Static</option>
                    <option value="relative" ${position === "relative" ? "selected" : ""}>Relative</option>
                    <option value="absolute" ${position === "absolute" ? "selected" : ""}>Absolute</option>
                    <option value="fixed" ${position === "fixed" ? "selected" : ""}>Fixed</option>
                    <option value="sticky" ${position === "sticky" ? "selected" : ""}>Sticky</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Flex Direction</label>
                  <select id="flex-direction-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="row" ${flexDirection === "row" ? "selected" : ""}>Row</option>
                    <option value="row-reverse" ${flexDirection === "row-reverse" ? "selected" : ""}>Row Reverse</option>
                    <option value="column" ${flexDirection === "column" ? "selected" : ""}>Column</option>
                    <option value="column-reverse" ${flexDirection === "column-reverse" ? "selected" : ""}>Column Reverse</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Justify Content</label>
                  <select id="justify-content-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="flex-start" ${justifyContent === "flex-start" ? "selected" : ""}>Flex Start</option>
                    <option value="flex-end" ${justifyContent === "flex-end" ? "selected" : ""}>Flex End</option>
                    <option value="center" ${justifyContent === "center" ? "selected" : ""}>Center</option>
                    <option value="space-between" ${justifyContent === "space-between" ? "selected" : ""}>Space Between</option>
                    <option value="space-around" ${justifyContent === "space-around" ? "selected" : ""}>Space Around</option>
                    <option value="space-evenly" ${justifyContent === "space-evenly" ? "selected" : ""}>Space Evenly</option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Align Items</label>
                  <select id="align-items-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="flex-start" ${alignItems === "flex-start" ? "selected" : ""}>Flex Start</option>
                    <option value="flex-end" ${alignItems === "flex-end" ? "selected" : ""}>Flex End</option>
                    <option value="center" ${alignItems === "center" ? "selected" : ""}>Center</option>
                    <option value="baseline" ${alignItems === "baseline" ? "selected" : ""}>Baseline</option>
                    <option value="stretch" ${alignItems === "stretch" ? "selected" : ""}>Stretch</option>
                  </select>
                </div>
              </div>
              `;
            }

            overlayContent!.insertAdjacentHTML("afterend", styleInputsTemplate);

            // Bind input events
            const fontSizeInput = document.getElementById("font-size-input") as HTMLInputElement;
            fontSizeInput?.addEventListener("input", (e) => {
            element.style.fontSize = `${(e.target as HTMLInputElement).value}px`;
          });

          const fontWeightInput = document.getElementById("font-weight-input") as HTMLSelectElement;
          fontWeightInput?.addEventListener("change", (e) => {
            element.style.fontWeight = (e.target as HTMLSelectElement).value;
          });

          const fontFamilyInput = document.getElementById("font-family-input") as HTMLSelectElement;
          fontFamilyInput?.addEventListener("change", (e) => {
            element.style.fontFamily = (e.target as HTMLSelectElement).value;
          });

          const lineHeightInput = document.getElementById("line-height-input") as HTMLInputElement;
          lineHeightInput?.addEventListener("input", (e) => {
            element.style.lineHeight = (e.target as HTMLInputElement).value;
          });

          const letterSpacingInput = document.getElementById("letter-spacing-input") as HTMLInputElement;
          letterSpacingInput?.addEventListener("input", (e) => {
            element.style.letterSpacing = (e.target as HTMLInputElement).value;
          });

          const textAlignInput = document.getElementById("text-align-input") as HTMLSelectElement;
          textAlignInput?.addEventListener("change", (e) => {
            element.style.textAlign = (e.target as HTMLSelectElement).value;
          });

          const textDecorationInput = document.getElementById("text-decoration-input") as HTMLSelectElement;
          textDecorationInput?.addEventListener("change", (e) => {
            element.style.textDecoration = (e.target as HTMLSelectElement).value;
          });

          const hoverColorInput = document.getElementById("hover-color-input") as HTMLInputElement;
          const hoverColorHexInput = document.getElementById("hover-color-hex-input") as HTMLInputElement;
          hoverColorInput?.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            element.style.setProperty('--hover-color', value);
            if (hoverColorHexInput) hoverColorHexInput.value = value;
          });
          hoverColorHexInput?.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            element.style.setProperty('--hover-color', value);
            if (hoverColorInput) hoverColorInput.value = value;
            });

            const colorInput = document.getElementById("color-input") as HTMLInputElement;
            const colorHexInput = document.getElementById("color-hex-input") as HTMLInputElement;
            colorInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
            element.style.color = value;
              if (colorHexInput) colorHexInput.value = value;
            });
            colorHexInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
            element.style.color = value;
              if (colorInput) colorInput.value = value;
            });

            const paddingTopInput = document.getElementById("padding-top-input") as HTMLInputElement;
            paddingTopInput?.addEventListener("input", (e) => {
              element.style.paddingTop = `${(e.target as HTMLInputElement).value}px`;
            });

            const paddingRightInput = document.getElementById("padding-right-input") as HTMLInputElement;
            paddingRightInput?.addEventListener("input", (e) => {
              element.style.paddingRight = `${(e.target as HTMLInputElement).value}px`;
            });

            const paddingBottomInput = document.getElementById("padding-bottom-input") as HTMLInputElement;
            paddingBottomInput?.addEventListener("input", (e) => {
              element.style.paddingBottom = `${(e.target as HTMLInputElement).value}px`;
            });

            const paddingLeftInput = document.getElementById("padding-left-input") as HTMLInputElement;
            paddingLeftInput?.addEventListener("input", (e) => {
              element.style.paddingLeft = `${(e.target as HTMLInputElement).value}px`;
            });

            const marginInput = document.getElementById("margin-input") as HTMLInputElement;
            marginInput?.addEventListener("input", (e) => {
            element.style.margin = `${(e.target as HTMLInputElement).value}px`;
            });

            const bgColorInput = document.getElementById("background-color-input") as HTMLInputElement;
            const bgColorHexInput = document.getElementById("background-color-hex-input") as HTMLInputElement;
            bgColorInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
            element.style.backgroundColor = value;
              if (bgColorHexInput) bgColorHexInput.value = value;
            });
            bgColorHexInput?.addEventListener("input", (e) => {
              const value = (e.target as HTMLInputElement).value;
            element.style.backgroundColor = value;
              if (bgColorInput) bgColorInput.value = value;
            });

          const borderWidthInput = document.getElementById("border-width-input") as HTMLInputElement;
          borderWidthInput?.addEventListener("input", (e) => {
            element.style.borderWidth = `${(e.target as HTMLInputElement).value}px`;
          });

          const borderColorInput = document.getElementById("border-color-input") as HTMLInputElement;
          const borderColorHexInput = document.getElementById("border-color-hex-input") as HTMLInputElement;
          borderColorInput?.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            element.style.borderColor = value;
            if (borderColorHexInput) borderColorHexInput.value = value;
          });
          borderColorHexInput?.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            element.style.borderColor = value;
            if (borderColorInput) borderColorInput.value = value;
          });

          const borderRadiusInput = document.getElementById("border-radius-input") as HTMLInputElement;
          borderRadiusInput?.addEventListener("input", (e) => {
            element.style.borderRadius = `${(e.target as HTMLInputElement).value}px`;
          });

          const displayInput = document.getElementById("display-input") as HTMLSelectElement;
          displayInput?.addEventListener("change", (e) => {
            const value = (e.target as HTMLSelectElement).value;
            element.style.display = value;
            
            // Show/hide grid template inputs based on display value
            const gridTemplateColumnsInput = document.getElementById("grid-template-columns-input") as HTMLSelectElement;
            const gridTemplateRowsInput = document.getElementById("grid-template-rows-input") as HTMLSelectElement;
            
            if (value === "grid") {
              if (!gridTemplateColumnsInput) {
                const computedStyle = window.getComputedStyle(element);
                const gridTemplateColumnsDiv = document.createElement("div");
                gridTemplateColumnsDiv.style.display = "flex";
                gridTemplateColumnsDiv.style.flexDirection = "column";
                gridTemplateColumnsDiv.style.gap = "6px";
                gridTemplateColumnsDiv.innerHTML = `
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Grid Template Columns</label>
                  <select id="grid-template-columns-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="1fr" ${computedStyle.gridTemplateColumns === "1fr" ? "selected" : ""}>1 Column</option>
                    <option value="1fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 1fr" ? "selected" : ""}>2 Columns</option>
                    <option value="1fr 1fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 1fr 1fr" ? "selected" : ""}>3 Columns</option>
                    <option value="1fr 1fr 1fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 1fr 1fr 1fr" ? "selected" : ""}>4 Columns</option>
                    <option value="1fr 2fr" ${computedStyle.gridTemplateColumns === "1fr 2fr" ? "selected" : ""}>2 Columns (1:2)</option>
                    <option value="2fr 1fr" ${computedStyle.gridTemplateColumns === "2fr 1fr" ? "selected" : ""}>2 Columns (2:1)</option>
                    <option value="1fr 2fr 1fr" ${computedStyle.gridTemplateColumns === "1fr 2fr 1fr" ? "selected" : ""}>3 Columns (1:2:1)</option>
                    <option value="auto 1fr" ${computedStyle.gridTemplateColumns === "auto 1fr" ? "selected" : ""}>Auto + Fill</option>
                    <option value="1fr auto" ${computedStyle.gridTemplateColumns === "1fr auto" ? "selected" : ""}>Fill + Auto</option>
                    <option value="custom" ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "1fr 2fr", "2fr 1fr", "1fr 2fr 1fr", "auto 1fr", "1fr auto"].includes(computedStyle.gridTemplateColumns) ? "selected" : ""}>Custom...</option>
                  </select>
                  <div id="custom-grid-columns-container" style="display: ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "1fr 2fr", "2fr 1fr", "1fr 2fr 1fr", "auto 1fr", "1fr auto"].includes(computedStyle.gridTemplateColumns) ? "block" : "none"}; margin-top: 8px;">
                    <input type="text" id="custom-grid-columns-input" value="${computedStyle.gridTemplateColumns}" placeholder="e.g., 1fr 1fr 1fr" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                  </div>
                `;
                displayInput.parentElement?.parentElement?.insertBefore(gridTemplateColumnsDiv, displayInput.parentElement.nextSibling);
                
                const gridTemplateRowsDiv = document.createElement("div");
                gridTemplateRowsDiv.style.display = "flex";
                gridTemplateRowsDiv.style.flexDirection = "column";
                gridTemplateRowsDiv.style.gap = "6px";
                gridTemplateRowsDiv.innerHTML = `
                  <label style="font-size: 13px; color: #495057; font-weight: 500;">Grid Template Rows</label>
                  <select id="grid-template-rows-input" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; background-color: white;">
                    <option value="1fr" ${computedStyle.gridTemplateRows === "1fr" ? "selected" : ""}>1 Row</option>
                    <option value="1fr 1fr" ${computedStyle.gridTemplateRows === "1fr 1fr" ? "selected" : ""}>2 Rows</option>
                    <option value="1fr 1fr 1fr" ${computedStyle.gridTemplateRows === "1fr 1fr 1fr" ? "selected" : ""}>3 Rows</option>
                    <option value="1fr 1fr 1fr 1fr" ${computedStyle.gridTemplateRows === "1fr 1fr 1fr 1fr" ? "selected" : ""}>4 Rows</option>
                    <option value="auto 1fr" ${computedStyle.gridTemplateRows === "auto 1fr" ? "selected" : ""}>Auto + Fill</option>
                    <option value="1fr auto" ${computedStyle.gridTemplateRows === "1fr auto" ? "selected" : ""}>Fill + Auto</option>
                    <option value="auto 1fr auto" ${computedStyle.gridTemplateRows === "auto 1fr auto" ? "selected" : ""}>Header + Content + Footer</option>
                    <option value="custom" ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "auto 1fr", "1fr auto", "auto 1fr auto"].includes(computedStyle.gridTemplateRows) ? "selected" : ""}>Custom...</option>
                  </select>
                  <div id="custom-grid-rows-container" style="display: ${!["1fr", "1fr 1fr", "1fr 1fr 1fr", "1fr 1fr 1fr 1fr", "auto 1fr", "1fr auto", "auto 1fr auto"].includes(computedStyle.gridTemplateRows) ? "block" : "none"}; margin-top: 8px;">
                    <input type="text" id="custom-grid-rows-input" value="${computedStyle.gridTemplateRows}" placeholder="e.g., auto 1fr auto" style="padding: 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box;" />
                  </div>
                `;
                displayInput.parentElement?.parentElement?.insertBefore(gridTemplateRowsDiv, gridTemplateColumnsDiv.nextSibling);
                
                // Add event listeners for the new inputs
                const newGridTemplateColumnsInput = document.getElementById("grid-template-columns-input") as HTMLSelectElement;
                const newGridTemplateRowsInput = document.getElementById("grid-template-rows-input") as HTMLSelectElement;
                const customGridColumnsInput = document.getElementById("custom-grid-columns-input") as HTMLInputElement;
                const customGridRowsInput = document.getElementById("custom-grid-rows-input") as HTMLInputElement;
                const customGridColumnsContainer = document.getElementById("custom-grid-columns-container") as HTMLDivElement;
                const customGridRowsContainer = document.getElementById("custom-grid-rows-container") as HTMLDivElement;
                
                newGridTemplateColumnsInput?.addEventListener("change", (e) => {
                  const value = (e.target as HTMLSelectElement).value;
                  if (value === "custom") {
                    customGridColumnsContainer.style.display = "block";
                    if (customGridColumnsInput) {
                      customGridColumnsInput.value = element.style.gridTemplateColumns || "";
                      customGridColumnsInput.focus();
                    }
                  } else {
                    customGridColumnsContainer.style.display = "none";
                    element.style.gridTemplateColumns = value;
                  }
                });
                
                newGridTemplateRowsInput?.addEventListener("change", (e) => {
                  const value = (e.target as HTMLSelectElement).value;
                  if (value === "custom") {
                    customGridRowsContainer.style.display = "block";
                    if (customGridRowsInput) {
                      customGridRowsInput.value = element.style.gridTemplateRows || "";
                      customGridRowsInput.focus();
                    }
                  } else {
                    customGridRowsContainer.style.display = "none";
                    element.style.gridTemplateRows = value;
                  }
                });
                
                customGridColumnsInput?.addEventListener("input", (e) => {
                  element.style.gridTemplateColumns = (e.target as HTMLInputElement).value;
                });
                
                customGridRowsInput?.addEventListener("input", (e) => {
                  element.style.gridTemplateRows = (e.target as HTMLInputElement).value;
                });
              }
            } else {
              gridTemplateColumnsInput?.parentElement?.remove();
              gridTemplateRowsInput?.parentElement?.remove();
            }
          });

          const positionInput = document.getElementById("position-input") as HTMLSelectElement;
          positionInput?.addEventListener("change", (e) => {
            element.style.position = (e.target as HTMLSelectElement).value;
          });

          const flexDirectionInput = document.getElementById("flex-direction-input") as HTMLSelectElement;
          flexDirectionInput?.addEventListener("change", (e) => {
            element.style.flexDirection = (e.target as HTMLSelectElement).value;
          });

          const justifyContentInput = document.getElementById("justify-content-input") as HTMLSelectElement;
          justifyContentInput?.addEventListener("change", (e) => {
            element.style.justifyContent = (e.target as HTMLSelectElement).value;
          });

          const alignItemsInput = document.getElementById("align-items-input") as HTMLSelectElement;
          alignItemsInput?.addEventListener("change", (e) => {
            element.style.alignItems = (e.target as HTMLSelectElement).value;
            });

            const widthInput = document.getElementById("width-input") as HTMLInputElement;
            widthInput?.addEventListener("input", (e) => {
            element.style.width = `${(e.target as HTMLInputElement).value}px`;
            });

            const heightInput = document.getElementById("height-input") as HTMLInputElement;
            heightInput?.addEventListener("input", (e) => {
            element.style.height = `${(e.target as HTMLInputElement).value}px`;
          });

          const objectFitInput = document.getElementById("object-fit-input") as HTMLSelectElement;
          objectFitInput?.addEventListener("change", (e) => {
            element.style.objectFit = (e.target as HTMLSelectElement).value;
          });

          const opacityInput = document.getElementById("opacity-input") as HTMLInputElement;
          opacityInput?.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            element.style.opacity = value;
            opacityInput.nextElementSibling!.textContent = value;
          });

          const filterInput = document.getElementById("filter-input") as HTMLSelectElement;
          const customFilterContainer = document.getElementById("custom-filter-container") as HTMLDivElement;
          const customFilterInput = document.getElementById("custom-filter-input") as HTMLInputElement;

          filterInput?.addEventListener("change", (e) => {
            const value = (e.target as HTMLSelectElement).value;
            if (value === "custom") {
              customFilterContainer.style.display = "block";
              if (customFilterInput) {
                customFilterInput.value = element.style.filter || "none";
                customFilterInput.focus();
              }
            } else {
              customFilterContainer.style.display = "none";
              element.style.filter = value;
            }
          });

          customFilterInput?.addEventListener("input", (e) => {
            element.style.filter = (e.target as HTMLInputElement).value;
          });
        }
      },
    });
  };

  return (
    <div style={{
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "15px",
      backgroundColor: "#f8f9fa",
      minWidth: "200px"
    }}>
      <h2 style={{
        margin: "0",
        fontSize: "18px",
        color: "#333",
        fontWeight: "600"
      }}>Style Inspector</h2>
      <p style={{
        margin: "0",
        fontSize: "14px",
        color: "#666",
        lineHeight: "1.4"
      }}>Click the button below to start inspecting and modifying styles on the current page.</p>
      <button
        onClick={onClick}
        style={{
          padding: "12px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
          transition: "background-color 0.2s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          width: "100%"
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#0056b3"}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#007bff"}
      >
        Open Inspector
      </button>
    </div>
  );
};

export default App;
